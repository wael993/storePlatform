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
} from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	useGetCurrencySettingsQuery,
	useGetExpensesQuery,
	useGetPartnersQuery,
	usePostDailyActionMutation,
	useUpdateDailyActionMutation,
} from '../../api/apiStore'
import { DailyActionType } from '../../shared/globalEnums'
import { formatNumberForDb, mapFee, parseNumberValue } from '../../shared/utils'
import { datePickerStyles, documentNameStyles } from '../../theme/styles'
import DatePickerLabel from '../common/DatePickerLabel'
import InputLabel from '../common/InputLabel'
import useCustomToast from '../common/CustomToast'
import DropdownLabel from '../DropdownLabel'
import { PAGE_COLORS } from './constants'
import { useSee } from '../../shared/hooks/useSee'
import { SEE } from '../../shared/seeFlags'
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
	customers: Customer[]
	suppliers: Supplier[]
}

const ENTRY_TYPES: QuickEntryType[] = [
	DailyActionType.RECEIPT_ENTRY,
	DailyActionType.PAYMENT_ENTRY,
	DailyActionType.EXPENSE_ENTRY,
]

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
	invoiceDate: getTodayDateInputValue(),
	note: '',
})

const QuickEntryModal = ({
	isOpen,
	onClose,
	mode = 'create',
	initialEntry = null,
	customers,
	suppliers,
}: QuickEntryModalProps) => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const { canSee } = useSee()
	const hasInitializedCurrency = useRef(false)
	const previousEntryType = useRef<QuickEntryType>(
		DailyActionType.RECEIPT_ENTRY,
	)

	const isEditing = mode === 'edit' && canSee(SEE.invoicesEntriesEdit)
	const isReadOnly = mode === 'view' || (mode === 'edit' && !isEditing)

	const [form, setForm] = useState(createInitialFormState)
	const [postDailyAction, { isLoading: isCreating }] =
		usePostDailyActionMutation()
	const [updateDailyAction, { isLoading: isUpdating }] =
		useUpdateDailyActionMutation()

	const isSaving = isCreating || isUpdating

	const { data: currencySettings, isLoading: isCurrenciesLoading } =
		useGetCurrencySettingsQuery(undefined, { skip: !isOpen })
	const currencyOptions = useMemo(
		() =>
			buildDisplayCurrencyOptions(currencySettings).map(option => ({
				value: option.currencyId,
				label: option.name,
			})),
		[currencySettings],
	)
	const { data: expenses = [], isLoading: isExpensesLoading } =
		useGetExpensesQuery(undefined, { skip: !isOpen })
	const { data: partners = [], isLoading: isPartnersLoading } =
		useGetPartnersQuery(undefined, { skip: !isOpen })

	useEffect(() => {
		if (!isOpen) {
			hasInitializedCurrency.current = false
			previousEntryType.current = DailyActionType.RECEIPT_ENTRY
			setForm(createInitialFormState())
			return
		}

		if (initialEntry && mode !== 'create') {
			const mapped = mapDailyActionToQuickEntryForm(initialEntry)
			if (mapped) {
				setForm(mapped)
				previousEntryType.current = mapped.entryType
				hasInitializedCurrency.current = true
			}
		}
	}, [initialEntry, isOpen, mode])

	useEffect(() => {
		if (isReadOnly || form.entryType === previousEntryType.current) return
		previousEntryType.current = form.entryType
		setForm(current => ({ ...current, entityId: '', entityName: '' }))
	}, [form.entryType, isReadOnly])

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
				return [...partnerOptions, ...customerOptions]
			case DailyActionType.PAYMENT_ENTRY:
				return [...partnerOptions, ...supplierOptions]
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

	const selectedEntityOption = useMemo(
		() =>
			form.entityId
				? entityOptions.filter(option => option.value === form.entityId)
				: [],
		[entityOptions, form.entityId],
	)

	const selectedCurrencyOption = useMemo(
		() =>
			form.currencyId
				? currencyOptions.filter(option => option.value === form.currencyId)
				: [],
		[currencyOptions, form.currencyId],
	)

	const isEntityLoading =
		(form.entryType === DailyActionType.EXPENSE_ENTRY && isExpensesLoading) ||
		((form.entryType === DailyActionType.RECEIPT_ENTRY ||
			form.entryType === DailyActionType.PAYMENT_ENTRY) &&
			isPartnersLoading)

	const isSaveDisabled =
		isSaving ||
		isCurrenciesLoading ||
		isEntityLoading ||
		!form.entityId ||
		!form.currencyId ||
		!form.amount.trim() ||
		!form.invoiceDate

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
			singleUnitPrice: formatNumberForDb(form.amount, 2) ?? undefined,
			invoiceDate: form.invoiceDate,
			note: optionalString(form.note),
		}
	}

	const handleSave = async () => {
		const payload = buildPayload()

		try {
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
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
			<ModalOverlay />
			<ModalContent borderRadius="xl">
				<ModalHeader fontWeight={700} fontSize="lg" pb={2}>
					{modalTitle}
				</ModalHeader>
				<ModalCloseButton />
				<ModalBody pt={0} pb={4}>
					<HStack spacing={2} mb={4}>
						{ENTRY_TYPES.map(entryType => {
							const isSelected = form.entryType === entryType
							return (
								<Button
									key={entryType}
									flex={1}
									size="sm"
									fontWeight={600}
									borderRadius="lg"
									variant={isSelected ? 'solid' : 'outline'}
									bg={isSelected ? PAGE_COLORS.primary : 'transparent'}
									color={isSelected ? 'white' : 'gray.700'}
									borderColor={PAGE_COLORS.border}
									isDisabled={isReadOnly}
									_hover={{
										bg: isSelected ? '#1D4ED8' : 'gray.50',
									}}
									onClick={() =>
										setForm(current => ({ ...current, entryType }))
									}
								>
									{entryTypeLabels[entryType]}
								</Button>
							)
						})}
					</HStack>

					<Divider mb={4} borderColor={PAGE_COLORS.border} />

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
						<InputLabel
							withGap
							label={t('common.amount')}
							inputPlaceholder={t('common.amount')}
							inputType="text"
							styles={documentNameStyles}
							value={mapFee(form.amount) ?? '0'}
							isDisabled={isReadOnly}
							onChange={(value: string) =>
								setForm(current => ({
									...current,
									amount: parseNumberValue(value, 2),
								}))
							}
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
							withGap
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
