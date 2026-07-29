import {
	Box,
	Button,
	Flex,
	Grid,
	HStack,
	Icon,
	IconButton,
	Input,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	Spinner,
	Text,
	Textarea,
	VStack,
} from '@chakra-ui/react'
import { AddIcon, ChevronDownIcon, CloseIcon } from '@chakra-ui/icons'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	useGetBuyingInvoiceQuery,
	useGetInvoiceSettingsQuery,
	useGetSuppliersQuery,
	usePostBuyingInvoiceMutation,
	useUpdateBuyingInvoiceMutation,
} from '../../api/apiStore'
import { PAGE_COLORS } from '../SellingInvoice/constants'
import { calculateInvoiceTotals } from '../SellingInvoice/invoiceCalculations'
import {
	applyInvoiceLevelDiscount,
	clearInvoiceDiscountFields,
	getInvoiceDiscountSettings,
} from '../SellingInvoice/invoiceDiscountDraft'
import EditableDiscountField from '../SellingInvoice/EditableDiscountField'
import InvoiceLineItemsTable from '../SellingInvoice/InvoiceLineItemsTable'
import InvoiceProductSearch from '../SellingInvoice/InvoiceProductSearch'
import { addProductToLineItems } from '../SellingInvoice/productLineItem'
import { useInvoiceDisplayCurrency } from '../SellingInvoice/useInvoiceDisplayCurrency'
import CurrencyAmountTooltip from '../SellingInvoice/CurrencyAmountTooltip'
import DropdownLabel from '../DropdownLabel'
import { AsDollarSignIcon } from '../../icons/DollarSign'
import { AsPauseIcon } from '../../icons/Pause'
import { AsSaveIcon } from '../icons/Save'
import { AsPriceTagIcon } from '../../shared/icons/PriceTag'
import { AsDocumentIcon } from '../../shared/icons/Document'
import DatePickerLabel from '../common/DatePickerLabel'
import {
	formatDateInputValue,
	parseDateInputValue,
} from '../../shared/dateUtils'
import { useUser } from '../../shared/hooks/useUser'
import {
	buildBuyingInvoiceRequestBody,
	mapApiBuyingInvoiceToDraft,
} from './buyingInvoiceApiMappers'
import { createBuyingInvoiceDraft } from './buyingInvoiceDraftSessions'
import useCustomToast from '../common/CustomToast'
import type {
	BuyingInvoiceDraft,
	BuyingInvoiceLineItem,
	BuyingInvoicePaymentType,
} from './types'

export interface BuyingInvoiceDraftTab {
	id: string
	label: string
}

export type BuyingInvoicePanelMode = 'create' | 'view' | 'edit'

interface NewBuyingInvoicePanelProps {
	isActive: boolean
	onClose: () => void
	onSaved?: () => void
	mode?: BuyingInvoicePanelMode
	buyingInvoiceId?: string
	onRequestEdit?: () => void
	nextInvoiceNumber?: number
	initialProductSearch?: string
	initialPaymentType?: BuyingInvoicePaymentType
	draft?: BuyingInvoiceDraft
	onDraftChange?: (
		updater:
			| BuyingInvoiceDraft
			| ((current: BuyingInvoiceDraft) => BuyingInvoiceDraft),
	) => void
	showNote?: boolean
	onShowNoteChange?: (showNote: boolean) => void
	draftTabs?: BuyingInvoiceDraftTab[]
	activeDraftTabId?: string
	onSelectDraftTab?: (tabId: string) => void
	onCloseDraftTab?: (tabId: string) => void
	onAddDraftTab?: () => void
	suppliers?: Supplier[]
	salesPerson?: string
}

const PaymentTypeButton = ({
	type,
	label,
	icon,
	isActive,
	isDisabled = false,
	onClick,
}: {
	type: BuyingInvoicePaymentType
	label: string
	icon: React.ReactNode
	isActive: boolean
	isDisabled?: boolean
	onClick: (type: BuyingInvoicePaymentType) => void
}) => {
	const activeStyles = {
		cash: { bg: '#DCFCE7', color: '#15803D', borderColor: '#86EFAC' },
		credit: { bg: '#FFEDD5', color: '#C2410C', borderColor: '#FDBA74' },
	}[type]

	return (
		<Button
			flex={1}
			variant="outline"
			leftIcon={icon as React.ReactElement}
			size="sm"
			fontWeight={600}
			borderRadius="lg"
			bg={isActive ? activeStyles.bg : 'white'}
			color={isActive ? activeStyles.color : PAGE_COLORS.muted}
			borderColor={isActive ? activeStyles.borderColor : PAGE_COLORS.border}
			isDisabled={isDisabled}
			onClick={() => onClick(type)}
		>
			{label}
		</Button>
	)
}

const panelStyles = {
	root: {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		minH: '0',
		bg: 'white',
		borderRadius: 'xl',
		border: '1px solid',
		borderColor: PAGE_COLORS.border,
		boxShadow: PAGE_COLORS.cardShadow,
		overflow: 'hidden',
	},
	header: {
		alignItems: 'center',
		justifyContent: 'space-between',
		px: { base: '4', md: '5' },
		py: '4',
		borderBottom: '1px solid',
		borderColor: PAGE_COLORS.border,
		flexShrink: '0',
		bg: 'white',
	},
	body: {
		flex: '1',
		minH: '0',
		overflowY: 'auto',
		px: { base: '4', md: '5' },
		py: '5',
		display: 'flex',
		flexDirection: 'column',
		gap: '5',
	},
} satisfies StylesObject

const NewBuyingInvoicePanel = ({
	isActive,
	onClose,
	onSaved,
	mode = 'create',
	buyingInvoiceId,
	onRequestEdit,
	nextInvoiceNumber = 1,
	initialProductSearch = '',
	initialPaymentType = 'cash',
	draft: controlledDraft,
	onDraftChange,
	showNote: controlledShowNote,
	onShowNoteChange,
	draftTabs = [],
	activeDraftTabId,
	onSelectDraftTab,
	onCloseDraftTab,
	onAddDraftTab,
	suppliers: suppliersProp,
	salesPerson: salesPersonProp,
}: NewBuyingInvoicePanelProps) => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const { user } = useUser()
	const isReadOnly = mode === 'view'
	const isExistingInvoice = mode === 'view' || mode === 'edit'
	const { data: fetchedSuppliers = [] } = useGetSuppliersQuery(
		{},
		{
			skip: suppliersProp !== undefined,
			refetchOnMountOrArgChange: false,
		},
	)
	const { data: invoiceSettings } = useGetInvoiceSettingsQuery(undefined, {
		refetchOnMountOrArgChange: false,
	})
	const suppliers = suppliersProp ?? fetchedSuppliers
	const salesPerson =
		salesPersonProp ||
		[user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
		user?.email ||
		'User'

	const [postBuyingInvoice, { isLoading: isCreating }] =
		usePostBuyingInvoiceMutation()
	const [updateBuyingInvoice, { isLoading: isUpdating }] =
		useUpdateBuyingInvoiceMutation()
	const {
		data: existingInvoice,
		isLoading: isLoadingInvoice,
		isError: isInvoiceError,
	} = useGetBuyingInvoiceQuery(buyingInvoiceId ?? '', {
		skip: !isActive || !buyingInvoiceId || !isExistingInvoice,
	})
	const isSaving = isCreating || isUpdating
	const [saveError, setSaveError] = useState<string | null>(null)
	const isControlledCreate = Boolean(controlledDraft && onDraftChange)

	const [internalDraft, setInternalDraft] = useState<BuyingInvoiceDraft>(() =>
		createBuyingInvoiceDraft(salesPerson, { paymentType: initialPaymentType }),
	)
	const [internalShowNote, setInternalShowNote] = useState(false)

	const draft =
		isControlledCreate && controlledDraft ? controlledDraft : internalDraft
	const setDraft =
		isControlledCreate && onDraftChange ? onDraftChange : setInternalDraft
	const showNote = isControlledCreate
		? Boolean(controlledShowNote)
		: internalShowNote
	const setShowNote = isControlledCreate
		? (value: boolean) => onShowNoteChange?.(value)
		: setInternalShowNote

	const {
		options: displayCurrencyOptions,
		displayCurrencyId,
		setDisplayCurrencyId,
		formatAmount,
		hasCurrencyOptions,
		currencySettings,
	} = useInvoiceDisplayCurrency()

	useEffect(() => {
		if (!isActive || isControlledCreate || isExistingInvoice) return

		setInternalDraft(
			createBuyingInvoiceDraft(salesPerson, {
				paymentType: initialPaymentType,
				invoiceNumber: nextInvoiceNumber,
			}),
		)
		setInternalShowNote(false)
		setSaveError(null)
	}, [
		isActive,
		isControlledCreate,
		isExistingInvoice,
		initialPaymentType,
		nextInvoiceNumber,
		salesPerson,
	])

	useEffect(() => {
		if (!isActive || !isExistingInvoice || !existingInvoice) return

		setInternalDraft(mapApiBuyingInvoiceToDraft(existingInvoice))
		setInternalShowNote(Boolean(existingInvoice.notes?.trim()))
		setSaveError(null)
	}, [existingInvoice, isActive, isExistingInvoice])

	useEffect(() => {
		if (!draft.salesPerson && salesPerson) {
			setDraft(current => ({ ...current, salesPerson }))
		}
	}, [draft.salesPerson, salesPerson, setDraft])

	useEffect(() => {
		if (!isControlledCreate) return
		setSaveError(null)
	}, [isControlledCreate, controlledDraft?.invoiceId])

	const totals = useMemo(
		() =>
			calculateInvoiceTotals(
				draft.lineItems,
				getInvoiceDiscountSettings(draft),
			),
		[
			draft.lineItems,
			draft.useInvoiceDiscount,
			draft.invoiceDiscount,
			draft.invoiceDiscountIsPercent,
		],
	)

	useEffect(() => {
		if (isReadOnly || draft.paymentType !== 'cash') return

		setDraft(current => ({
			...current,
			paidAmount: calculateInvoiceTotals(
				current.lineItems,
				getInvoiceDiscountSettings(current),
			).grandTotal,
		}))
	}, [
		draft.lineItems,
		draft.paymentType,
		draft.useInvoiceDiscount,
		draft.invoiceDiscount,
		draft.invoiceDiscountIsPercent,
		isReadOnly,
		setDraft,
	])

	const changeAmount = Math.max(0, draft.paidAmount - totals.grandTotal)

	const supplierOptions = useMemo(
		(): Pick<Supplier, 'supplierId' | 'name'>[] => suppliers,
		[suppliers],
	)

	const hasSupplier = Boolean(draft.supplierId)
	const hasSalesPerson = Boolean((draft.salesPerson || salesPerson).trim())

	const handleAddProduct = (product: Product) => {
		setDraft(current => ({
			...current,
			lineItems: addProductToLineItems(current.lineItems, product, 'buying', {
				noMergeInvoiceLines: invoiceSettings?.noMergeInvoiceLines ?? false,
				currencyOptions: displayCurrencyOptions,
			}),
		}))
	}

	const handleUpdateItem = (
		id: string,
		updates: Partial<BuyingInvoiceLineItem>,
	) => {
		setDraft(current => {
			const clearsInvoiceDiscount =
				'discount' in updates || 'discountIsPercent' in updates

			return {
				...current,
				...(clearsInvoiceDiscount ? clearInvoiceDiscountFields() : {}),
				lineItems: current.lineItems.map(item =>
					item.id === id ? { ...item, ...updates } : item,
				),
			}
		})
	}

	const handleInvoiceDiscountEdit = (
		discount: number,
		discountIsPercent: boolean,
	) => {
		const invoiceDiscountFields = applyInvoiceLevelDiscount(
			discount,
			discountIsPercent,
		)

		setDraft(current => ({
			...current,
			...invoiceDiscountFields,
			lineItems: invoiceDiscountFields.useInvoiceDiscount
				? current.lineItems.map(item => ({
						...item,
						discount: 0,
						discountIsPercent: true,
					}))
				: current.lineItems,
		}))
	}

	const handleRemoveItem = (id: string) => {
		setDraft(current => ({
			...current,
			lineItems: current.lineItems.filter(item => item.id !== id),
		}))
	}

	const handleSupplierChange = (supplierId: string) => {
		const supplier = supplierOptions.find(
			option => option.supplierId === supplierId,
		)

		setDraft(current => ({
			...current,
			supplierId,
			supplierName: supplier?.name ?? current.supplierName,
		}))
	}

	const handlePaymentTypeChange = (paymentType: BuyingInvoicePaymentType) => {
		setDraft(current => ({
			...current,
			paymentType,
			paidAmount: paymentType === 'cash' ? totals.grandTotal : 0,
		}))
	}

	const canSave = draft.lineItems.length > 0 && hasSupplier && hasSalesPerson

	const handleSaveInvoice = async (
		status: 'draft' | 'partial' | 'paid' | 'cancelled' | 'confirmed',
	) => {
		if (!canSave) return

		setSaveError(null)

		try {
			const body = buildBuyingInvoiceRequestBody(
				draft,
				status,
				currencySettings,
			)
			if (isExistingInvoice) {
				await updateBuyingInvoice({
					buyingInvoiceId: draft.invoiceId,
					body,
				}).unwrap()
			} else {
				await postBuyingInvoice(body).unwrap()
			}
			showToast({
				title: t('components.buyingInvoices.drawer.saveSuccess'),
				status: 'success',
				duration: 3000,
			})
			onSaved?.()
		} catch (error) {
			const apiError = error as {
				data?: { message?: string }
			}

			setSaveError(
				apiError.data?.message ??
					t('components.buyingInvoices.drawer.saveFailed'),
			)
		}
	}

	const panelTitleKey =
		mode === 'view'
			? 'components.sellingInvoices.drawer.viewTitle'
			: mode === 'edit'
				? 'components.sellingInvoices.drawer.editTitle'
				: 'components.buyingInvoices.drawer.title'

	if (!isActive) return null

	if (isExistingInvoice && isLoadingInvoice) {
		return (
			<Box sx={panelStyles.root}>
				<Flex justify="center" align="center" flex={1} py={16}>
					<Spinner color={PAGE_COLORS.primary} />
				</Flex>
			</Box>
		)
	}

	if (isExistingInvoice && (isInvoiceError || !existingInvoice)) {
		return (
			<Box sx={panelStyles.root}>
				<Flex sx={panelStyles.header}>
					<Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight={700}>
						{t(panelTitleKey)}
					</Text>
					<IconButton
						aria-label={t('components.buyingInvoices.drawer.close')}
						icon={<CloseIcon boxSize={3} />}
						variant="ghost"
						size="sm"
						onClick={onClose}
					/>
				</Flex>
				<Flex justify="center" align="center" flex={1} py={16}>
					<Text color={PAGE_COLORS.danger}>
						{t('components.sellingInvoices.drawer.loadFailed')}
					</Text>
				</Flex>
			</Box>
		)
	}

	return (
		<Box sx={panelStyles.root}>
			<Flex sx={panelStyles.header}>
				<HStack spacing={2} align="center" minW={0} flex={1}>
					<Text
						fontSize={{ base: 'lg', md: 'xl' }}
						fontWeight={700}
						noOfLines={1}
					>
						{t(panelTitleKey)}{' '}
						<Text as="span" color={PAGE_COLORS.primary}>
							#{draft.invoiceNumber}
						</Text>
					</Text>
					{onAddDraftTab && (
						<IconButton
							aria-label={t('components.buyingInvoices.drawer.newDraftTab')}
							icon={<AddIcon boxSize={2.5} />}
							size="xs"
							variant="outline"
							borderRadius="md"
							borderColor={PAGE_COLORS.border}
							color={PAGE_COLORS.primary}
							flexShrink={0}
							onClick={onAddDraftTab}
						/>
					)}
				</HStack>
				<HStack spacing={2}>
					{mode === 'view' && onRequestEdit && (
						<Button size="sm" onClick={onRequestEdit}>
							{t('components.sellingInvoices.actions.edit')}
						</Button>
					)}
					<IconButton
						aria-label={t('components.buyingInvoices.drawer.close')}
						icon={<CloseIcon boxSize={3} />}
						variant="ghost"
						size="sm"
						onClick={onClose}
					/>
				</HStack>
			</Flex>

			{draftTabs.length > 0 && (
				<HStack
					px={{ base: 4, md: 5 }}
					py={2}
					spacing={2}
					overflowX="auto"
					borderBottom="1px solid"
					borderColor={PAGE_COLORS.border}
					bg="gray.50"
				>
					{draftTabs.map(tab => {
						const isActiveTab = tab.id === activeDraftTabId
						return (
							<HStack
								key={tab.id}
								as="button"
								type="button"
								spacing={1}
								px={3}
								py={1.5}
								borderRadius="md"
								border="1px solid"
								borderColor={
									isActiveTab ? PAGE_COLORS.primary : PAGE_COLORS.border
								}
								bg={isActiveTab ? 'white' : 'transparent'}
								color={isActiveTab ? PAGE_COLORS.primary : PAGE_COLORS.muted}
								fontSize="sm"
								fontWeight={isActiveTab ? 600 : 500}
								flexShrink={0}
								onClick={() => onSelectDraftTab?.(tab.id)}
								_hover={{ bg: 'white', borderColor: PAGE_COLORS.primary }}
							>
								<Text as="span">{tab.label}</Text>
								{draftTabs.length > 1 && onCloseDraftTab && (
									<Box
										as="span"
										role="button"
										aria-label={t(
											'components.buyingInvoices.drawer.closeDraftTab',
										)}
										display="inline-flex"
										alignItems="center"
										justifyContent="center"
										boxSize={4}
										borderRadius="sm"
										onClick={(event: { stopPropagation: () => void }) => {
											event.stopPropagation()
											onCloseDraftTab(tab.id)
										}}
										_hover={{ bg: 'gray.200' }}
									>
										<CloseIcon boxSize={2} />
									</Box>
								)}
							</HStack>
						)
					})}
				</HStack>
			)}

			<Box sx={panelStyles.body}>
				<Grid
					templateColumns={{
						base: '1fr',
						md: 'repeat(2, 1fr)',
						'2xl': 'repeat(3, 1fr)',
					}}
					gap={3}
				>
					<DatePickerLabel
						label={t('components.buyingInvoices.drawer.invoiceDate')}
						onChange={date =>
							setDraft(current => ({
								...current,
								invoiceDate: date
									? formatDateInputValue(date)
									: current.invoiceDate,
							}))
						}
						defaultDate={parseDateInputValue(draft.invoiceDate)}
					/>
					<Box>
						<Text
							fontSize="xs"
							fontWeight={600}
							color={PAGE_COLORS.muted}
							mb={3.5}
						>
							{t('components.buyingInvoices.drawer.invoiceTime')}
						</Text>
						<Input
							type="time"
							value={draft.invoiceTime}
							onChange={event =>
								setDraft(current => ({
									...current,
									invoiceTime: event.target.value,
								}))
							}
							backgroundColor={PAGE_COLORS.border}
							disabled
							borderRadius="none"
							borderColor={PAGE_COLORS.border}
						/>
					</Box>

					<DropdownLabel
						label={t('components.buyingInvoices.drawer.salesPerson')}
						options={[
							{
								label: draft.salesPerson || salesPerson,
								value: draft.salesPerson || salesPerson,
							},
						]}
						selectedOptions={[
							{
								label: draft.salesPerson || salesPerson,
								value: draft.salesPerson || salesPerson,
							},
						]}
						onSelect={values =>
							setDraft(current => ({
								...current,
								salesPerson: values[0] ?? current.salesPerson ?? salesPerson,
							}))
						}
						placeholder={t('components.buyingInvoices.drawer.salesPerson')}
						isSingle
						isSearchable
						isDisabled
						customStyles={{
							dropdownContainer: {
								width: '100%',
							},
							dropdownMenu: {
								mt: '0.4rem',
								borderRadius: 'none',
								width: '100%',
							},
							dropdownPlaceholder: {
								width: '100%',
							},
						}}
					/>

					<DropdownLabel
						label={t('components.buyingInvoices.drawer.supplier')}
						options={supplierOptions.map(supplier => ({
							label: supplier.name,
							value: supplier.supplierId,
						}))}
						selectedOptions={
							draft.supplierId
								? [{ label: draft.supplierName, value: draft.supplierId }]
								: []
						}
						onSelect={values => handleSupplierChange(values[0] ?? '')}
						placeholder={t('components.buyingInvoices.drawer.supplier')}
						isSingle
						isSearchable
						isDisabled={isReadOnly}
						customStyles={{
							dropdownContainer: {
								width: '100%',
							},
							dropdownMenu: {
								mt: '0.4rem',
								borderRadius: 'none',
								width: '100%',
							},
							dropdownPlaceholder: {
								width: '100%',
							},
						}}
					/>
				</Grid>

				<Box>
					<Text fontSize="xs" fontWeight={600} color={PAGE_COLORS.muted} mb={2}>
						{t('components.buyingInvoices.drawer.paymentType')}
					</Text>
					<HStack spacing={2}>
						<PaymentTypeButton
							type="cash"
							label={t('components.buyingInvoices.paymentType.cash')}
							icon={<AsDollarSignIcon fill="none" />}
							isActive={draft.paymentType === 'cash'}
							isDisabled={isReadOnly}
							onClick={handlePaymentTypeChange}
						/>
						<PaymentTypeButton
							type="credit"
							label={t('components.buyingInvoices.paymentType.credit')}
							icon={<AsPriceTagIcon fill="none" />}
							isActive={draft.paymentType === 'credit'}
							isDisabled={isReadOnly}
							onClick={handlePaymentTypeChange}
						/>
					</HStack>
				</Box>

				{!isReadOnly && (
					<Box>
						<InvoiceProductSearch
							onAddProduct={handleAddProduct}
							initialSearch={initialProductSearch}
							autoFocus={isActive}
						/>
					</Box>
				)}

				<InvoiceLineItemsTable
					lineItems={draft.lineItems}
					onUpdateItem={handleUpdateItem}
					onRemoveItem={handleRemoveItem}
					formatAmount={formatAmount}
					displayCurrencyId={displayCurrencyId}
					currencyOptions={displayCurrencyOptions}
					isReadOnly={isReadOnly}
					invoiceKind="buying"
				/>

				{hasCurrencyOptions && (
					<Box maxW={{ base: '100%', md: '20rem' }}>
						<DropdownLabel
							label={t('components.buyingInvoices.drawer.displayCurrency')}
							options={displayCurrencyOptions.map(option => ({
								label: `${option.name} (${option.label})`,
								value: option.currencyId,
							}))}
							selectedOptions={
								displayCurrencyId
									? displayCurrencyOptions
											.filter(option => option.currencyId === displayCurrencyId)
											.map(option => ({
												label: `${option.name} (${option.label})`,
												value: option.currencyId,
											}))
									: []
							}
							onSelect={values => setDisplayCurrencyId(values[0] ?? null)}
							placeholder={t(
								'components.buyingInvoices.drawer.displayCurrency',
							)}
							isSingle
							isSearchable={false}
							customStyles={{
								dropdownContainer: { width: '100%' },
								dropdownMenu: {
									mt: '0.4rem',
									borderRadius: 'none',
									width: '100%',
								},
								dropdownPlaceholder: { width: '100%' },
							}}
						/>
					</Box>
				)}

				<Grid
					templateColumns={{ base: '1fr', lg: '1.2fr 1fr 1fr' }}
					gap={4}
					mt="auto"
					pt={2}
				>
					<Box>
						{showNote ? (
							<Button
								variant="link"
								color={PAGE_COLORS.primary}
								fontWeight={600}
								fontSize="sm"
								onClick={() => setShowNote(true)}
							>
								{t('components.buyingInvoices.drawer.addNote')}
							</Button>
						) : (
							<VStack align="stretch" spacing={2}>
								<Text fontSize="sm" fontWeight={600} color="gray.700">
									{t('components.buyingInvoices.drawer.additionalInfo')}
								</Text>
								<Textarea
									value={draft.note}
									onChange={event =>
										setDraft(current => ({
											...current,
											note: event.target.value,
										}))
									}
									placeholder={t(
										'components.buyingInvoices.drawer.notePlaceholder',
									)}
									borderRadius="lg"
									borderColor={PAGE_COLORS.border}
									rows={3}
								/>
							</VStack>
						)}
					</Box>

					<Box
						bg="gray.50"
						borderRadius="lg"
						p={4}
						border="1px solid"
						borderColor={PAGE_COLORS.border}
					>
						<VStack align="stretch" spacing={2}>
							<Flex justify="space-between">
								<Text fontSize="sm" color={PAGE_COLORS.muted}>
									{t('components.buyingInvoices.drawer.subtotal')}
								</Text>
								<CurrencyAmountTooltip
									amount={totals.subtotal}
									displayText={formatAmount(totals.subtotal)}
									options={displayCurrencyOptions}
									displayCurrencyId={displayCurrencyId}
									fontWeight={500}
								/>
							</Flex>
							<Flex justify="space-between">
								<Text fontSize="sm" color={PAGE_COLORS.muted}>
									{t('components.buyingInvoices.drawer.discount')}
								</Text>
								{isReadOnly ? (
									<CurrencyAmountTooltip
										amount={totals.discount}
										displayText={formatAmount(totals.discount)}
										options={displayCurrencyOptions}
										displayCurrencyId={displayCurrencyId}
										fontWeight={500}
									/>
								) : (
									<EditableDiscountField
										discount={
											draft.useInvoiceDiscount
												? draft.invoiceDiscount
												: totals.discount
										}
										discountIsPercent={
											draft.useInvoiceDiscount
												? draft.invoiceDiscountIsPercent
												: false
										}
										discountAmount={totals.discount}
										formatAmount={formatAmount}
										fontWeight={500}
										currencyOptions={displayCurrencyOptions}
										displayCurrencyId={displayCurrencyId}
										onSave={handleInvoiceDiscountEdit}
									/>
								)}
							</Flex>
							<Flex justify="space-between">
								<Text fontSize="sm" color={PAGE_COLORS.muted}>
									{t('components.buyingInvoices.drawer.tax')}
								</Text>
								<CurrencyAmountTooltip
									amount={totals.tax}
									displayText={formatAmount(totals.tax)}
									options={displayCurrencyOptions}
									displayCurrencyId={displayCurrencyId}
									fontWeight={500}
								/>
							</Flex>
							<Box
								borderTop="1px solid"
								borderColor={PAGE_COLORS.border}
								pt={2}
							>
								<Flex justify="space-between" align="center">
									<Text fontWeight={700}>
										{t('components.buyingInvoices.drawer.grandTotal')}
									</Text>
									<CurrencyAmountTooltip
										amount={totals.grandTotal}
										displayText={formatAmount(totals.grandTotal)}
										options={displayCurrencyOptions}
										displayCurrencyId={displayCurrencyId}
										fontSize="2xl"
										fontWeight={700}
										color={PAGE_COLORS.primary}
									/>
								</Flex>
							</Box>
						</VStack>
					</Box>

					<Box
						bg="gray.50"
						borderRadius="lg"
						p={4}
						border="1px solid"
						borderColor={PAGE_COLORS.border}
					>
						<VStack align="stretch" spacing={3}>
							<Box>
								<Text
									fontSize="xs"
									fontWeight={600}
									color={PAGE_COLORS.muted}
									mb={1}
								>
									{t('components.buyingInvoices.drawer.paidAmount')}
								</Text>
								<CurrencyAmountTooltip
									amount={draft.paidAmount}
									displayText={formatAmount(draft.paidAmount)}
									options={displayCurrencyOptions}
									displayCurrencyId={displayCurrencyId}
									fontSize="xl"
									fontWeight={700}
									onEdit={
										draft.paymentType === 'credit'
											? undefined
											: paidAmount =>
													setDraft(current => ({
														...current,
														paidAmount,
													}))
									}
								/>
							</Box>
							<Box>
								<Text
									fontSize="xs"
									fontWeight={600}
									color={PAGE_COLORS.muted}
									mb={1}
								>
									{t('components.buyingInvoices.drawer.change')}
								</Text>
								<CurrencyAmountTooltip
									amount={changeAmount}
									displayText={formatAmount(changeAmount)}
									options={displayCurrencyOptions}
									displayCurrencyId={displayCurrencyId}
									fontSize="xl"
									fontWeight={700}
									color={PAGE_COLORS.success}
								/>
							</Box>
						</VStack>
					</Box>
				</Grid>

				{saveError && (
					<Text fontSize="sm" color={PAGE_COLORS.danger}>
						{saveError}
					</Text>
				)}

				{!isReadOnly && (
					<Flex
						gap={3}
						pt={2}
						pb={1}
						direction={{ base: 'column', sm: 'row' }}
						flexShrink={0}
					>
						<Button
							variant="outline"
							leftIcon={
								<Icon
									as={AsDocumentIcon}
									color={PAGE_COLORS.primary}
									boxSize={5}
								/>
							}
							borderRadius="lg"
							borderColor={PAGE_COLORS.border}
							flex={{ base: 1, sm: 'none' }}
							onClick={() => handleSaveInvoice('draft')}
							isLoading={isSaving}
							isDisabled={!canSave}
						>
							{t('components.buyingInvoices.drawer.saveDraft')}
						</Button>
						<Button
							variant="outline"
							leftIcon={
								<Icon
									as={AsPauseIcon}
									color={PAGE_COLORS.primary}
									boxSize={5}
								/>
							}
							borderRadius="lg"
							borderColor={PAGE_COLORS.border}
							flex={{ base: 1, sm: 'none' }}
							onClick={() => handleSaveInvoice('draft')}
							isLoading={isSaving}
							isDisabled={!canSave}
						>
							{t('components.buyingInvoices.drawer.holdInvoice')}
						</Button>
						<HStack spacing={0} flex={1}>
							<Menu>
								<MenuButton
									as={Button}
									bg={PAGE_COLORS.primary}
									color="white"
									borderTopLeftRadius={0}
									borderBottomLeftRadius={0}
									borderTopRightRadius="lg"
									borderBottomRightRadius="lg"
									minW="auto"
									px={2}
									borderLeft="1px solid"
									borderColor="#1D4ED8"
									_hover={{ bg: '#1D4ED8' }}
									isDisabled={!canSave}
								>
									<ChevronDownIcon />
								</MenuButton>
								<MenuList>
									<MenuItem onClick={() => handleSaveInvoice('draft')}>
										{t('components.buyingInvoices.drawer.saveDraft')}
									</MenuItem>
									<MenuItem onClick={() => handleSaveInvoice('draft')}>
										{t('components.buyingInvoices.drawer.holdInvoice')}
									</MenuItem>
								</MenuList>
							</Menu>
							<Button
								rightIcon={
									<Icon
										as={AsSaveIcon}
										fill="none"
										color={PAGE_COLORS.cardShadow}
										boxSize={5}
									/>
								}
								bg={PAGE_COLORS.primary}
								color="white"
								borderTopLeftRadius="lg"
								borderBottomLeftRadius="lg"
								borderTopRightRadius={0}
								borderBottomRightRadius={0}
								fontWeight={600}
								flex={1}
								_hover={{ bg: '#1D4ED8' }}
								isDisabled={!canSave}
								isLoading={isSaving}
								onClick={() => {
									if (draft.paymentType === 'credit') {
										handleSaveInvoice('confirmed')
										return
									}

									handleSaveInvoice(
										draft.paidAmount + 0.009 >= totals.grandTotal
											? 'paid'
											: 'partial',
									)
								}}
							>
								{draft.paymentType === 'cash'
									? t('components.buyingInvoices.drawer.payCashAndSave')
									: t('components.buyingInvoices.drawer.saveCreditInvoice')}
							</Button>
						</HStack>
					</Flex>
				)}
			</Box>
		</Box>
	)
}

export default NewBuyingInvoicePanel
