import {
	Button,
	Divider,
	HStack,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	SimpleGrid,
	Text,
	Tooltip,
} from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	useGetCashAccountBalancesQuery,
	useGetCurrencySettingsQuery,
	useGetExpensesQuery,
	useGetPartnersQuery,
	usePostCashTransferMutation,
	usePostDailyActionMutation,
	useUpdateDailyActionMutation,
} from '../../api/apiStore'
import { getApiErrorMessage } from '../../offline/getApiErrorMessage'
import { getWorkMode } from '../../offline/workMode'
import { buildEntryInvoiceDateIso } from '../../shared/dateUtils'
import { DailyActionType } from '../../shared/globalEnums'
import {
	compareLanguage,
	formatNumber,
	formatNumberForDb,
	parseNumberValue,
} from '../../shared/utils'
import { datePickerStyles, documentNameStyles } from '../../theme/styles'
import DatePickerLabel from '../common/DatePickerLabel'
import InputLabel from '../common/InputLabel'
import useCustomToast from '../common/CustomToast'
import DropdownLabel from '../DropdownLabel'
import { PAGE_COLORS } from './constants'
import { useSee } from '../../shared/hooks/useSee'
import { useOfflineSync } from '../../shared/hooks/useOfflineSync'
import { useUser } from '../../shared/hooks/useUser'
import { SEE } from '../../shared/seeFlags'
import { currencyBalanceOf } from 'store-domain'

import { buildDisplayCurrencyOptions } from './currencyDisplay'
import {
	getDailyActionId,
	mapDailyActionToQuickEntryForm,
	type QuickEntryFormState,
	type QuickEntryType,
} from './entryTableMappers'

export type QuickEntryModalMode = 'create' | 'view' | 'edit'

interface QuickEntryModalProps {
	isOpen: boolean
	onClose: () => void
	mode?: QuickEntryModalMode
	initialEntry?: DailyAction | null
	initialPartyId?: string
	initialPartyName?: string
	customers: Customer[]
	suppliers: Supplier[]
}

const ENTRY_TYPES: QuickEntryType[] = [
	DailyActionType.RECEIPT_ENTRY,
	DailyActionType.PAYMENT_ENTRY,
	DailyActionType.EXPENSE_ENTRY,
]

const TRANSFER_TAB = 'transfer' as const
type ModalTab = QuickEntryType | typeof TRANSFER_TAB

const CASH_ACCOUNT_OPTIONS = [
	{ value: 'daily_cash', labelKey: 'dashboard.cashAccounts.dailyCash' },
	{ value: 'cash_reserve', labelKey: 'dashboard.cashAccounts.cashReserve' },
	{ value: 'online', labelKey: 'dashboard.cashAccounts.online' },
] as const

type TransferFormState = {
	fromAccountType: string
	toAccountType: string
	amount: string
	currencyId: string
	currencyName: string
	reason: string
}

const getTodayDateInputValue = () => {
	const today = new Date()
	const month = String(today.getMonth() + 1).padStart(2, '0')
	const day = String(today.getDate()).padStart(2, '0')
	return `${today.getFullYear()}-${month}-${day}`
}

const getDateFromInputValue = (value: string) => {
	const [year, month, day] = value.split('-').map(Number)
	return new Date(year, month - 1, day)
}

const createInitialFormState = (): QuickEntryFormState => ({
	entryType: DailyActionType.RECEIPT_ENTRY,
	entityId: '',
	entityName: '',
	amount: '',
	currencyId: '',
	currencyName: '',
	cashAccountType: 'daily_cash',
	invoiceDate: getTodayDateInputValue(),
	note: '',
})

const createInitialTransferForm = (): TransferFormState => ({
	fromAccountType: 'daily_cash',
	toAccountType: 'cash_reserve',
	amount: '',
	currencyId: '',
	currencyName: '',
	reason: '',
})

const QuickEntryModal = ({
	isOpen,
	onClose,
	mode = 'create',
	initialEntry = null,
	initialPartyId,
	initialPartyName,
	customers,
	suppliers,
}: QuickEntryModalProps) => {
	const showToast = useCustomToast()
	const { canSee } = useSee()
	const { user } = useUser()
	const { isOnline } = useOfflineSync(user?.tenantId)
	const cashOpsOnline = isOnline && getWorkMode() !== 'offline'
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const hasInitializedCurrency = useRef(false)
	const previousEntryType = useRef<QuickEntryType>(
		DailyActionType.RECEIPT_ENTRY,
	)

	const isEditing = mode === 'edit' && canSee(SEE.invoicesEntriesEdit)
	const isReadOnly = mode === 'view' || (mode === 'edit' && !isEditing)
	const canShowTransferTab = mode === 'create'

	const [form, setForm] = useState(createInitialFormState)
	const [transferForm, setTransferForm] = useState(createInitialTransferForm)
	const [activeTab, setActiveTab] = useState<ModalTab>(
		DailyActionType.RECEIPT_ENTRY,
	)
	const [postDailyAction, { isLoading: isCreating }] =
		usePostDailyActionMutation()
	const [updateDailyAction, { isLoading: isUpdating }] =
		useUpdateDailyActionMutation()
	const [postCashTransfer, { isLoading: isTransferring }] =
		usePostCashTransferMutation()

	const isTransferTab = activeTab === TRANSFER_TAB
	const isSaving = isCreating || isUpdating || isTransferring

	const { data: currencySettings, isLoading: isCurrenciesLoading } =
		useGetCurrencySettingsQuery(undefined, {
			skip: !isOpen || isReadOnly,
			refetchOnMountOrArgChange: false,
		})
	const displayCurrencyOptions = useMemo(
		() => buildDisplayCurrencyOptions(currencySettings),
		[currencySettings],
	)
	const currencyOptions = useMemo(
		() =>
			displayCurrencyOptions.map(option => ({
				value: option.currencyId,
				label: option.name,
			})),
		[displayCurrencyOptions],
	)
	const { data: cashBalances } = useGetCashAccountBalancesQuery(undefined, {
		skip: !isOpen || isReadOnly || !cashOpsOnline,
		refetchOnMountOrArgChange: false,
	})
	const { data: expenses = [], isLoading: isExpensesLoading } =
		useGetExpensesQuery(undefined, {
			skip: !isOpen || isReadOnly || isTransferTab,
			refetchOnMountOrArgChange: false,
		})
	const { data: partners = [], isLoading: isPartnersLoading } =
		useGetPartnersQuery(undefined, {
			skip: !isOpen || isReadOnly || isTransferTab,
			refetchOnMountOrArgChange: false,
		})

	useEffect(() => {
		if (!isOpen) {
			hasInitializedCurrency.current = false
			previousEntryType.current = DailyActionType.RECEIPT_ENTRY
			setForm(createInitialFormState())
			setTransferForm(createInitialTransferForm())
			setActiveTab(DailyActionType.RECEIPT_ENTRY)
			return
		}

		if (initialEntry && mode !== 'create') {
			const mapped = mapDailyActionToQuickEntryForm(initialEntry)
			if (mapped) {
				setForm(mapped)
				previousEntryType.current = mapped.entryType
				setActiveTab(mapped.entryType)
				hasInitializedCurrency.current = true
			}
			return
		}

		if (mode === 'create' && initialPartyId) {
			setForm(current => ({
				...current,
				entityId: initialPartyId,
				entityName: initialPartyName ?? '',
			}))
		}
	}, [initialEntry, initialPartyId, initialPartyName, isOpen, mode])

	useEffect(() => {
		if (cashOpsOnline || activeTab !== TRANSFER_TAB) return
		setActiveTab(DailyActionType.RECEIPT_ENTRY)
		setForm(current => ({
			...current,
			entryType: DailyActionType.RECEIPT_ENTRY,
		}))
	}, [activeTab, cashOpsOnline])

	useEffect(() => {
		if (
			!isOpen ||
			mode !== 'create' ||
			hasInitializedCurrency.current ||
			!currencyOptions.length
		) {
			return
		}

		const defaultCurrency = currencyOptions[0]
		setForm(current => ({
			...current,
			currencyId: defaultCurrency.value,
			currencyName: defaultCurrency.label,
		}))
		setTransferForm(current => ({
			...current,
			currencyId: defaultCurrency.value,
			currencyName: defaultCurrency.label,
		}))
		hasInitializedCurrency.current = true
	}, [currencyOptions, isOpen, mode])

	const modalTitle = useMemo(() => {
		if (mode === 'view') {
			return t('components.sellingInvoices.entries.viewTitle')
		}
		if (mode === 'edit') {
			return t('components.sellingInvoices.entries.editTitle')
		}
		return t('components.sellingInvoices.entries.title')
	}, [mode, t])

	const entryTypeLabels: Record<QuickEntryType, string> = useMemo(
		() => ({
			[DailyActionType.RECEIPT_ENTRY]: t('common.receiptEntry'),
			[DailyActionType.PAYMENT_ENTRY]: t('common.paymentEntry'),
			[DailyActionType.EXPENSE_ENTRY]: t('common.expenseEntry'),
		}),
		[t],
	)

	const cashAccountOptions = useMemo(
		(): DropdownOption[] =>
			CASH_ACCOUNT_OPTIONS.map(option => ({
				value: option.value,
				label: t(option.labelKey),
			})),
		[t],
	)

	const entityLabel = useMemo(() => {
		switch (form.entryType) {
			case DailyActionType.RECEIPT_ENTRY:
				return t('common.customer')
			case DailyActionType.PAYMENT_ENTRY:
				return t('common.supplier')
			case DailyActionType.EXPENSE_ENTRY:
				return t('common.expense')
		}
	}, [form.entryType, t])

	const entityPlaceholder = useMemo(() => {
		switch (form.entryType) {
			case DailyActionType.RECEIPT_ENTRY:
				return t('common.customerName')
			case DailyActionType.PAYMENT_ENTRY:
				return t('common.supplierName')
			case DailyActionType.EXPENSE_ENTRY:
				return t('common.expenseName')
		}
	}, [form.entryType, t])

	const partnerOptions = useMemo(
		(): DropdownOption[] =>
			partners
				.map(partner => ({
					value: partner.partnerId ?? partner.internalCode ?? '',
					label: partner.name ?? partner.internalCode ?? 'TBD',
				}))
				.filter(option => Boolean(option.value)),
		[partners],
	)

	const customerOptions = useMemo(
		(): DropdownOption[] =>
			customers.map(customer => ({
				value: customer.customerId,
				label: customer.name,
			})),
		[customers],
	)

	const supplierOptions = useMemo(
		(): DropdownOption[] =>
			suppliers.map(supplier => ({
				value: supplier.supplierId,
				label: supplier.name,
			})),
		[suppliers],
	)

	const entityOptions = useMemo((): DropdownOption[] => {
		switch (form.entryType) {
			case DailyActionType.RECEIPT_ENTRY:
				return [...partnerOptions, ...customerOptions, ...supplierOptions]
			case DailyActionType.PAYMENT_ENTRY:
				return [...partnerOptions, ...supplierOptions, ...customerOptions]
			case DailyActionType.EXPENSE_ENTRY:
				return expenses
					.map(expense => ({
						value: expense.expenseId ?? expense.internalCode ?? '',
						label: expense.name ?? expense.internalCode ?? 'TBD',
					}))
					.filter(option => Boolean(option.value))
		}
	}, [
		customerOptions,
		expenses,
		form.entryType,
		partnerOptions,
		supplierOptions,
	])

	useEffect(() => {
		if (
			isReadOnly ||
			isTransferTab ||
			form.entryType === previousEntryType.current
		) {
			return
		}
		if (isPartnersLoading && form.entryType !== DailyActionType.EXPENSE_ENTRY) {
			return
		}
		previousEntryType.current = form.entryType
		setForm(current =>
			entityOptions.some(option => option.value === current.entityId)
				? current
				: { ...current, entityId: '', entityName: '' },
		)
	}, [
		entityOptions,
		form.entryType,
		isPartnersLoading,
		isReadOnly,
		isTransferTab,
	])

	const selectedEntityOption = useMemo(() => {
		if (!form.entityId) return []
		const match = entityOptions.filter(option => option.value === form.entityId)
		if (match.length > 0) return match
		return form.entityName
			? [{ value: form.entityId, label: form.entityName }]
			: []
	}, [entityOptions, form.entityId, form.entityName])

	const selectedCurrencyOption = useMemo(() => {
		if (!form.currencyId) return []
		const match = currencyOptions.filter(
			option => option.value === form.currencyId,
		)
		if (match.length > 0) return match
		return form.currencyName
			? [{ value: form.currencyId, label: form.currencyName }]
			: []
	}, [currencyOptions, form.currencyId, form.currencyName])

	const selectedFromAccount = useMemo(
		() =>
			transferForm.fromAccountType
				? cashAccountOptions.filter(
						option => option.value === transferForm.fromAccountType,
					)
				: [],
		[cashAccountOptions, transferForm.fromAccountType],
	)

	const selectedToAccount = useMemo(
		() =>
			transferForm.toAccountType
				? cashAccountOptions.filter(
						option => option.value === transferForm.toAccountType,
					)
				: [],
		[cashAccountOptions, transferForm.toAccountType],
	)

	const selectedTransferCurrencyOption = useMemo(
		() =>
			transferForm.currencyId
				? currencyOptions.filter(
						option => option.value === transferForm.currencyId,
					)
				: [],
		[currencyOptions, transferForm.currencyId],
	)

	const fromAccountBalance = useMemo(() => {
		const account = cashBalances?.accounts.find(
			item => item.type === transferForm.fromAccountType,
		)
		return currencyBalanceOf(account?.balances, transferForm.currencyId)
	}, [
		cashBalances?.accounts,
		transferForm.currencyId,
		transferForm.fromAccountType,
	])

	const transferAmount = useMemo(() => {
		const amountRaw = formatNumberForDb(transferForm.amount, 2)
		const displayAmount = amountRaw == null ? NaN : Number(amountRaw)
		if (!(displayAmount > 0) || !transferForm.currencyId) return 0

		return displayAmount
	}, [transferForm.amount, transferForm.currencyId])

	const hasCashBalances = Boolean(cashBalances)
	const isInsufficientTransfer =
		hasCashBalances && transferAmount > 0 && transferAmount > fromAccountBalance

	const insufficientTransferMessage = useMemo(() => {
		if (!isInsufficientTransfer) return null

		const currencyLabel =
			transferForm.currencyName ||
			displayCurrencyOptions.find(
				option => option.currencyId === transferForm.currencyId,
			)?.label ||
			''

		return t('components.sellingInvoices.entries.insufficientBalance', {
			available: formatNumber(fromAccountBalance) ?? '0.00',
			currency: currencyLabel,
		})
	}, [
		displayCurrencyOptions,
		fromAccountBalance,
		isInsufficientTransfer,
		t,
		transferForm.currencyId,
		transferForm.currencyName,
	])

	const isCashOutEntry =
		form.entryType === DailyActionType.PAYMENT_ENTRY ||
		form.entryType === DailyActionType.EXPENSE_ENTRY

	const selectedCashAccountBalance = useMemo(() => {
		const account = cashBalances?.accounts.find(
			item => item.type === form.cashAccountType,
		)
		return currencyBalanceOf(account?.balances, form.currencyId)
	}, [cashBalances?.accounts, form.cashAccountType, form.currencyId])

	const selectedCashAccountOption = useMemo(
		() =>
			form.cashAccountType
				? cashAccountOptions.filter(
						option => option.value === form.cashAccountType,
					)
				: [],
		[cashAccountOptions, form.cashAccountType],
	)

	const entryAmount = useMemo(() => {
		const amountRaw = formatNumberForDb(form.amount, 2)
		const displayAmount = amountRaw == null ? NaN : Number(amountRaw)
		if (!(displayAmount > 0) || !form.currencyId) return 0

		return displayAmount
	}, [form.amount, form.currencyId])

	const previousCashOut = useMemo(() => {
		if (!isEditing || !initialEntry || !isCashOutEntry) return 0

		const previousAccountType = initialEntry.cashAccountType || 'daily_cash'
		if (previousAccountType !== form.cashAccountType) return 0
		if (initialEntry.currencyId !== form.currencyId) return 0

		const amountRaw = formatNumberForDb(
			initialEntry.singleUnitPrice ?? initialEntry.totalPrice ?? '',
			2,
		)
		const displayAmount = amountRaw == null ? NaN : Number(amountRaw)
		if (!(displayAmount > 0)) return 0

		return displayAmount
	}, [
		form.cashAccountType,
		form.currencyId,
		initialEntry,
		isCashOutEntry,
		isEditing,
	])

	const availableCashOut = selectedCashAccountBalance + previousCashOut

	const isInsufficientCashOut =
		!isTransferTab &&
		isCashOutEntry &&
		!isReadOnly &&
		hasCashBalances &&
		entryAmount > 0 &&
		entryAmount > availableCashOut

	const insufficientCashOutMessage = useMemo(() => {
		if (!isInsufficientCashOut) return null

		const currencyLabel =
			form.currencyName ||
			displayCurrencyOptions.find(
				option => option.currencyId === form.currencyId,
			)?.label ||
			''

		return t('components.sellingInvoices.entries.insufficientBalance', {
			available: formatNumber(availableCashOut) ?? '0.00',
			currency: currencyLabel,
		})
	}, [
		availableCashOut,
		displayCurrencyOptions,
		form.currencyId,
		form.currencyName,
		isInsufficientCashOut,
		t,
	])

	const cashAccountFieldLabel =
		form.entryType === DailyActionType.RECEIPT_ENTRY
			? t('components.sellingInvoices.entries.toAccount')
			: t('components.sellingInvoices.entries.fromAccount')

	const isEntityLoading =
		(form.entryType === DailyActionType.EXPENSE_ENTRY && isExpensesLoading) ||
		((form.entryType === DailyActionType.RECEIPT_ENTRY ||
			form.entryType === DailyActionType.PAYMENT_ENTRY) &&
			isPartnersLoading)

	const isEntrySaveDisabled =
		isSaving ||
		isCurrenciesLoading ||
		isEntityLoading ||
		!form.entityId ||
		!form.currencyId ||
		!form.cashAccountType ||
		!form.amount.trim() ||
		!form.invoiceDate ||
		(isCashOutEntry && isInsufficientCashOut)

	const isTransferSaveDisabled =
		isSaving ||
		isCurrenciesLoading ||
		!cashOpsOnline ||
		!hasCashBalances ||
		!transferForm.fromAccountType ||
		!transferForm.toAccountType ||
		transferForm.fromAccountType === transferForm.toAccountType ||
		!transferForm.currencyId ||
		!transferForm.amount.trim() ||
		isInsufficientTransfer

	const isSaveDisabled = isTransferTab
		? isTransferSaveDisabled
		: isEntrySaveDisabled

	const isPartnerSelection = (entityId: string) =>
		partnerOptions.some(option => option.value === entityId)

	const buildPayload = () => {
		const optionalString = (value: string) => value.trim() || undefined
		const entityId = optionalString(form.entityId)
		const entityName = optionalString(form.entityName)
		const selectedPartner =
			entityId && isPartnerSelection(entityId)
				? { partnerId: entityId, partnerName: entityName }
				: {}

		return {
			entryType: form.entryType,
			customerId:
				form.entryType === DailyActionType.RECEIPT_ENTRY && entityId
					? isPartnerSelection(entityId)
						? undefined
						: entityId
					: undefined,
			customerName:
				form.entryType === DailyActionType.RECEIPT_ENTRY && entityName
					? isPartnerSelection(form.entityId)
						? undefined
						: entityName
					: undefined,
			supplierId:
				form.entryType === DailyActionType.PAYMENT_ENTRY && entityId
					? isPartnerSelection(entityId)
						? undefined
						: entityId
					: undefined,
			supplierName:
				form.entryType === DailyActionType.PAYMENT_ENTRY && entityName
					? isPartnerSelection(form.entityId)
						? undefined
						: entityName
					: undefined,
			expenseId:
				form.entryType === DailyActionType.EXPENSE_ENTRY ? entityId : undefined,
			expenseName:
				form.entryType === DailyActionType.EXPENSE_ENTRY
					? entityName
					: undefined,
			...selectedPartner,
			currencyId: form.currencyId,
			currencyName: form.currencyName,
			cashAccountType: form.cashAccountType,
			singleUnitPrice: formatNumberForDb(form.amount, 2) ?? undefined,
			invoiceDate: buildEntryInvoiceDateIso(form.invoiceDate),
			note: optionalString(form.note),
		}
	}

	const handleSave = async () => {
		try {
			if (isTransferTab) {
				if (!cashOpsOnline) return
				const amountRaw = formatNumberForDb(transferForm.amount, 2)
				const displayAmount = amountRaw == null ? NaN : Number(amountRaw)
				if (
					!(displayAmount > 0) ||
					!transferForm.currencyId ||
					isInsufficientTransfer
				) {
					return
				}

				await postCashTransfer({
					fromAccountType: transferForm.fromAccountType,
					toAccountType: transferForm.toAccountType,
					amount: displayAmount,
					currencyId: transferForm.currencyId,
					reason: transferForm.reason.trim() || undefined,
				}).unwrap()

				showToast({
					status: 'success',
					description: t(
						'components.sellingInvoices.entries.transferSavedSuccessfully',
					),
				})
				onClose()
				return
			}

			const payload = buildPayload()

			if (isInsufficientCashOut) return

			if (isEditing && initialEntry) {
				const entryId = getDailyActionId(initialEntry)
				await updateDailyAction({ id: entryId, body: payload }).unwrap()
			} else {
				await postDailyAction(payload).unwrap()
			}

			showToast({
				status: 'success',
				description: t('components.daily.actionSavedSuccessfully'),
			})
			onClose()
		} catch (error) {
			console.error('Error saving entry:', error)
			showToast({
				status: 'error',
				description: getApiErrorMessage(
					error,
					isTransferTab
						? t('components.sellingInvoices.entries.transferFailed')
						: t('components.sellingInvoices.entries.saveFailed'),
				),
			})
		}
	}

	const tabButton = (
		key: string,
		label: string,
		isSelected: boolean,
		onClick: () => void,
		disabled = isReadOnly,
	) => (
		<Button
			key={key}
			flex={1}
			size="sm"
			fontWeight={600}
			borderRadius="lg"
			variant={isSelected ? 'solid' : 'outline'}
			bg={isSelected ? PAGE_COLORS.primary : 'transparent'}
			color={isSelected ? 'white' : 'gray.700'}
			borderColor={PAGE_COLORS.border}
			isDisabled={disabled}
			_hover={{
				bg: isSelected ? '#1D4ED8' : 'gray.50',
			}}
			onClick={onClick}
		>
			{label}
		</Button>
	)

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
			<ModalOverlay />
			<ModalContent borderRadius="xl">
				<ModalHeader fontWeight={700} fontSize="lg" pb={2}>
					{modalTitle}
				</ModalHeader>
				<ModalCloseButton
					size="lg"
					sx={{
						left: isArabic ? '0.4rem' : 'auto',
						right: isArabic ? 'auto' : '0.4rem',
						marginRight: 0,
					}}
				/>
				<ModalBody pt={0} pb={4}>
					<HStack spacing={2} mb={4} flexWrap="wrap">
						{ENTRY_TYPES.map(entryType =>
							tabButton(
								entryType,
								entryTypeLabels[entryType],
								!isTransferTab && form.entryType === entryType,
								() => {
									setActiveTab(entryType)
									setForm(current => ({ ...current, entryType }))
								},
							),
						)}
						{canShowTransferTab && (
							<Tooltip
								label={t('components.sellingInvoices.entries.transferOffline')}
								isDisabled={cashOpsOnline}
							>
								<span style={{ flex: 1, display: 'flex' }}>
									{tabButton(
										TRANSFER_TAB,
										t('components.sellingInvoices.entries.transfer'),
										isTransferTab,
										() => setActiveTab(TRANSFER_TAB),
										!cashOpsOnline,
									)}
								</span>
							</Tooltip>
						)}
					</HStack>

					<Divider mb={4} borderColor={PAGE_COLORS.border} />

					{isTransferTab ? (
						<>
							<SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
								<DropdownLabel
									label={t('components.sellingInvoices.entries.fromAccount')}
									placeholder={t(
										'components.sellingInvoices.entries.fromAccount',
									)}
									options={cashAccountOptions}
									selectedOptions={selectedFromAccount}
									isSingle
									onSelect={(values: string[]) => {
										const selected = cashAccountOptions.find(
											option => option.value === values[0],
										)
										setTransferForm(current => ({
											...current,
											fromAccountType: selected?.value ?? '',
										}))
									}}
								/>
								<DropdownLabel
									label={t('components.sellingInvoices.entries.toAccount')}
									placeholder={t(
										'components.sellingInvoices.entries.toAccount',
									)}
									options={cashAccountOptions}
									selectedOptions={selectedToAccount}
									isSingle
									onSelect={(values: string[]) => {
										const selected = cashAccountOptions.find(
											option => option.value === values[0],
										)
										setTransferForm(current => ({
											...current,
											toAccountType: selected?.value ?? '',
										}))
									}}
								/>
								<DropdownLabel
									label={t('common.currency')}
									placeholder={t('common.currencyName')}
									options={currencyOptions}
									selectedOptions={selectedTransferCurrencyOption}
									isSingle
									isLoading={isCurrenciesLoading}
									onSelect={(values: string[]) => {
										const selected = currencyOptions.find(
											option => option.value === values[0],
										)
										setTransferForm(current => ({
											...current,
											currencyId: selected?.value ?? '',
											currencyName: selected?.label ?? '',
										}))
									}}
								/>
								<InputLabel
									label={t('common.amount')}
									inputPlaceholder={t('common.amount')}
									inputType="text"
									styles={documentNameStyles}
									value={transferForm.amount}
									onChange={(value: string) =>
										setTransferForm(current => ({
											...current,
											amount: parseNumberValue(value, 2),
										}))
									}
								/>
								<InputLabel
									label={t('components.sellingInvoices.entries.transferReason')}
									inputPlaceholder={t(
										'components.sellingInvoices.entries.transferReason',
									)}
									inputType="text"
									styles={documentNameStyles}
									value={transferForm.reason}
									onChange={(value: string) =>
										setTransferForm(current => ({
											...current,
											reason: value,
										}))
									}
								/>
							</SimpleGrid>
							{insufficientTransferMessage && (
								<Text mt={3} fontSize="sm" color="red.500">
									{insufficientTransferMessage}
								</Text>
							)}
						</>
					) : (
						<>
							<SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
								<DropdownLabel
									label={entityLabel}
									placeholder={entityPlaceholder}
									options={entityOptions}
									selectedOptions={selectedEntityOption}
									isSingle
									isSearchable
									isDisabled={isReadOnly}
									isLoading={isEntityLoading}
									onSelect={(values: string[]) => {
										const selected = entityOptions.find(
											option => option.value === values[0],
										)
										setForm(current => ({
											...current,
											entityId: selected?.value ?? '',
											entityName: selected?.label ?? '',
										}))
									}}
								/>
								<DropdownLabel
									label={cashAccountFieldLabel}
									placeholder={cashAccountFieldLabel}
									options={cashAccountOptions}
									selectedOptions={selectedCashAccountOption}
									isSingle
									isDisabled={isReadOnly}
									onSelect={(values: string[]) => {
										const selected = cashAccountOptions.find(
											option => option.value === values[0],
										)
										setForm(current => ({
											...current,
											cashAccountType: selected?.value ?? 'daily_cash',
										}))
									}}
								/>

								<InputLabel
									label={t('common.amount')}
									inputPlaceholder={t('common.amount')}
									inputType="text"
									styles={documentNameStyles}
									value={form.amount}
									isDisabled={isReadOnly}
									onChange={(value: string) =>
										setForm(current => ({
											...current,
											amount: parseNumberValue(value, 2),
										}))
									}
								/>
								<DropdownLabel
									label={t('common.currency')}
									placeholder={t('common.currencyName')}
									options={currencyOptions}
									selectedOptions={selectedCurrencyOption}
									isSingle
									isDisabled={isReadOnly}
									isLoading={isCurrenciesLoading}
									onSelect={(values: string[]) => {
										const selected = currencyOptions.find(
											option => option.value === values[0],
										)
										setForm(current => ({
											...current,
											currencyId: selected?.value ?? '',
											currencyName: selected?.label ?? '',
										}))
									}}
								/>
								<DatePickerLabel
									key={`${mode}-${initialEntry ? getDailyActionId(initialEntry) : 'new'}-${form.invoiceDate}`}
									label={t('common.date')}
									defaultDate={getDateFromInputValue(form.invoiceDate)}
									styles={datePickerStyles}
									isDisabled={isReadOnly}
									onChange={(date: Date | undefined) => {
										if (!date || isReadOnly) return
										const month = String(date.getMonth() + 1).padStart(2, '0')
										const day = String(date.getDate()).padStart(2, '0')
										setForm(current => ({
											...current,
											invoiceDate: `${date.getFullYear()}-${month}-${day}`,
										}))
									}}
								/>
								<InputLabel
									label={t('common.note')}
									inputPlaceholder={t('common.notePlaceholder')}
									inputType="text"
									styles={documentNameStyles}
									value={form.note}
									isDisabled={isReadOnly}
									onChange={(value: string) =>
										setForm(current => ({ ...current, note: value }))
									}
								/>
							</SimpleGrid>
							{insufficientCashOutMessage && (
								<Text mt={3} fontSize="sm" color="red.500">
									{insufficientCashOutMessage}
								</Text>
							)}
						</>
					)}
				</ModalBody>
				<ModalFooter
					gap={2}
					borderTop="1px solid"
					borderColor={PAGE_COLORS.border}
				>
					<Button variant="ghost" onClick={onClose} isDisabled={isSaving}>
						{isReadOnly
							? t('components.sellingInvoices.drawer.close')
							: t('common.cancel')}
					</Button>
					{!isReadOnly && (
						<Button
							bg={PAGE_COLORS.primary}
							color="white"
							_hover={{ bg: '#1D4ED8' }}
							onClick={handleSave}
							isLoading={isSaving}
							isDisabled={isSaveDisabled}
						>
							{t('common.submit')}
						</Button>
					)}
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default QuickEntryModal
