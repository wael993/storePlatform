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
	useGetCustomersQuery,
	useGetSellingInvoiceQuery,
	usePostSellingInvoiceMutation,
	useUpdateSellingInvoiceMutation,
} from '../../api/apiStore'
import { useUser } from '../../shared/hooks/useUser'
import useCustomToast from '../common/CustomToast'
import { PAGE_COLORS } from './constants'
import { calculateInvoiceTotals } from './invoiceCalculations'
import {
	applyInvoiceLevelDiscount,
	clearInvoiceDiscountFields,
	getInvoiceDiscountSettings,
} from './invoiceDiscountDraft'
import EditableDiscountField from './EditableDiscountField'
import {
	buildInvoiceRequestBody,
	mapApiInvoiceToDraft,
} from './invoiceApiMappers'
import { createInvoiceDraft, WALK_IN_CUSTOMER_ID } from './invoiceDraftSessions'
import InvoiceLineItemsTable from './InvoiceLineItemsTable'
import InvoiceProductSearch from './InvoiceProductSearch'
import {
	addProductToLineItems,
	syncLineItemCostReferences,
} from './productLineItem'
import { useProductCatalog } from './useProductCatalog'
import type {
	SellingInvoiceDraft,
	SellingInvoiceLineItem,
	SellingInvoicePaymentType,
} from './types'
import { useInvoiceDisplayCurrency } from './useInvoiceDisplayCurrency'
import CurrencyAmountTooltip from './CurrencyAmountTooltip'
import DropdownLabel from '../DropdownLabel'
import { AsDollarSignIcon } from '../../icons/DollarSign'
import { AsPauseIcon } from '../../icons/Pause'
import { AsSaveIcon } from '../icons/Save'
import { AsPriceTagIcon } from '../../shared/icons/PriceTag'
// import { AsCreditCardIcon } from '../../icons/CreditCard'
import { AsDocumentIcon } from '../../shared/icons/Document'
import { AsEditIcon } from '../../shared/icons/Edit'
import DatePickerLabel from '../common/DatePickerLabel'
import {
	formatDateInputValue,
	parseDateInputValue,
} from '../../shared/dateUtils'

export type InvoicePanelMode = 'create' | 'view' | 'edit'

export interface InvoiceDraftTab {
	id: string
	label: string
}

interface NewSellingInvoicePanelProps {
	isActive: boolean
	onClose: () => void
	onSaved?: () => void
	nextInvoiceNumber?: number
	initialProductSearch?: string
	initialPaymentType?: SellingInvoicePaymentType
	mode?: InvoicePanelMode
	invoiceId?: string
	onRequestEdit?: () => void
	/** Controlled draft for multi-tab create sessions */
	draft?: SellingInvoiceDraft
	onDraftChange?: (
		updater:
			| SellingInvoiceDraft
			| ((current: SellingInvoiceDraft) => SellingInvoiceDraft),
	) => void
	showNote?: boolean
	onShowNoteChange?: (showNote: boolean) => void
	draftTabs?: InvoiceDraftTab[]
	activeDraftTabId?: string
	onSelectDraftTab?: (tabId: string) => void
	onCloseDraftTab?: (tabId: string) => void
	onAddDraftTab?: () => void
	customers?: Customer[]
}

const PaymentTypeButton = ({
	type,
	label,
	icon,
	isActive,
	onClick,
	isDisabled = false,
}: {
	type: SellingInvoicePaymentType
	label: string
	icon: React.ReactNode
	isActive: boolean
	onClick: (type: SellingInvoicePaymentType) => void
	isDisabled?: boolean
}) => {
	const activeStyles = {
		cash: { bg: '#DCFCE7', color: '#15803D', borderColor: '#86EFAC' },
		card: { bg: '#DBEAFE', color: '#2563EB', borderColor: '#93C5FD' },
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
			onClick={() => onClick(type)}
			isDisabled={isDisabled}
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

const NewSellingInvoicePanel = ({
	isActive,
	onClose,
	onSaved,
	nextInvoiceNumber = 1,
	initialProductSearch = '',
	initialPaymentType = 'cash',
	mode = 'create',
	invoiceId,
	onRequestEdit,
	draft: controlledDraft,
	onDraftChange,
	showNote: controlledShowNote,
	onShowNoteChange,
	draftTabs = [],
	activeDraftTabId,
	onSelectDraftTab,
	onCloseDraftTab,
	onAddDraftTab,
	customers: customersProp,
}: NewSellingInvoicePanelProps) => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const { user } = useUser()
	const { data: fetchedCustomers = [] } = useGetCustomersQuery(undefined, {
		skip: customersProp !== undefined,
		refetchOnMountOrArgChange: false,
	})
	const customers = customersProp ?? fetchedCustomers
	const [postSellingInvoice, { isLoading: isCreating }] =
		usePostSellingInvoiceMutation()
	const [updateSellingInvoice, { isLoading: isUpdating }] =
		useUpdateSellingInvoiceMutation()
	const [saveError, setSaveError] = useState<string | null>(null)
	const isReadOnly = mode === 'view'
	const isExistingInvoice = mode === 'view' || mode === 'edit'
	const isSaving = isCreating || isUpdating
	const isControlledCreate =
		mode === 'create' && Boolean(controlledDraft && onDraftChange)

	const {
		data: existingInvoice,
		isLoading: isLoadingInvoice,
		isError: isInvoiceError,
	} = useGetSellingInvoiceQuery(invoiceId ?? '', {
		skip: !isActive || !invoiceId || !isExistingInvoice,
	})

	const salesPerson = [user?.firstName, user?.lastName]
		.filter(Boolean)
		.join(' ')

	const [internalDraft, setInternalDraft] = useState<SellingInvoiceDraft>(() =>
		createInvoiceDraft(salesPerson || user?.email || 'User', {
			paymentType: initialPaymentType,
		}),
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
	const { products: catalogProducts } = useProductCatalog()

	const {
		options: displayCurrencyOptions,
		displayCurrencyId,
		setDisplayCurrencyId,
		formatAmount,
		hasCurrencyOptions,
		currencySettings,
	} = useInvoiceDisplayCurrency()

	useEffect(() => {
		if (!isActive || isExistingInvoice || isControlledCreate) return

		setInternalDraft(
			createInvoiceDraft(salesPerson || user?.email || 'User', {
				paymentType: initialPaymentType,
				invoiceNumber: nextInvoiceNumber,
				customerName: t('components.sellingInvoices.drawer.walkInCustomer'),
			}),
		)
		setInternalShowNote(false)
		setSaveError(null)
	}, [
		isActive,
		isExistingInvoice,
		isControlledCreate,
		initialPaymentType,
		nextInvoiceNumber,
		salesPerson,
		user?.email,
		t,
	])

	useEffect(() => {
		if (!isActive || !isExistingInvoice || !existingInvoice) return

		setInternalDraft(
			mapApiInvoiceToDraft(
				existingInvoice,
				t('components.sellingInvoices.drawer.walkInCustomer'),
			),
		)
		setInternalShowNote(false)
		setSaveError(null)
	}, [isActive, isExistingInvoice, existingInvoice, t])

	useEffect(() => {
		if (isReadOnly || catalogProducts.length === 0) return

		setDraft(current => {
			const lineItems = syncLineItemCostReferences(
				current.lineItems,
				catalogProducts,
			)
			return lineItems === current.lineItems
				? current
				: { ...current, lineItems }
		})
	}, [catalogProducts, isReadOnly, setDraft])

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

	const customerOptions = useMemo(
		(): Pick<Customer, 'customerId' | 'name'>[] => [
			{
				customerId: WALK_IN_CUSTOMER_ID,
				name: t('components.sellingInvoices.drawer.walkInCustomer'),
			},
			...customers,
		],
		[customers, t],
	)

	const handleAddProduct = (product: Product) => {
		setDraft(current => ({
			...current,
			lineItems: addProductToLineItems(current.lineItems, product),
		}))
	}

	const handleUpdateItem = (
		id: string,
		updates: Partial<SellingInvoiceLineItem>,
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

	const handleCustomerChange = (customerId: string) => {
		const customer = customerOptions.find(
			option => option.customerId === customerId,
		)

		setDraft(current => ({
			...current,
			customerId,
			customerName: customer?.name ?? current.customerName,
		}))
	}

	const handlePaymentTypeChange = (paymentType: SellingInvoicePaymentType) => {
		setDraft(current => ({
			...current,
			paymentType,
			paidAmount: paymentType === 'cash' ? totals.grandTotal : 0,
		}))
	}

	const handleSaveInvoice = async (
		status: 'draft' | 'partial' | 'paid' | 'cancelled' | 'confirmed',
	) => {
		if (draft.lineItems.length === 0 || isReadOnly) return

		setSaveError(null)

		try {
			const body = buildInvoiceRequestBody(draft, status, currencySettings)

			if (mode === 'edit') {
				await updateSellingInvoice({
					invoiceId: draft.invoiceId,
					body,
				}).unwrap()
			} else {
				await postSellingInvoice(body).unwrap()
			}

			showToast({
				title: t('components.sellingInvoices.drawer.saveSuccess'),
				status: 'success',
				duration: 3000,
			})
			onSaved?.()
			// Create multi-draft: onSaved removes this tab and shows the next one.
			// Calling onClose here would hit stale draft state and open the discard dialog.
			if (mode !== 'create') {
				onClose()
			}
		} catch (error) {
			const apiError = error as {
				data?: { message?: string; code?: string }
			}
			// Offline selling can cancel after insufficient-stock confirm dialog.
			if (apiError.data?.code === 'INSUFFICIENT_STOCK_CANCELLED') return

			setSaveError(
				apiError.data?.message ??
					t('components.sellingInvoices.drawer.saveFailed'),
			)
		}
	}

	const panelTitleKey =
		mode === 'view'
			? 'components.sellingInvoices.drawer.viewTitle'
			: mode === 'edit'
				? 'components.sellingInvoices.drawer.editTitle'
				: 'components.sellingInvoices.drawer.title'

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
						aria-label={t('components.sellingInvoices.drawer.close')}
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
					{mode === 'create' && onAddDraftTab && (
						<IconButton
							aria-label={t('components.sellingInvoices.drawer.newDraftTab')}
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
				<HStack spacing={1}>
					{mode === 'view' && onRequestEdit && (
						<IconButton
							aria-label={t('components.sellingInvoices.actions.edit')}
							icon={
								<Icon as={AsEditIcon} color={PAGE_COLORS.primary} boxSize={5} />
							}
							variant="ghost"
							size="sm"
							onClick={onRequestEdit}
						/>
					)}
					<IconButton
						aria-label={t('components.sellingInvoices.drawer.close')}
						icon={<CloseIcon boxSize={3} />}
						variant="ghost"
						size="sm"
						onClick={onClose}
					/>
				</HStack>
			</Flex>

			{mode === 'create' && draftTabs.length > 0 && (
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
											'components.sellingInvoices.drawer.closeDraftTab',
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
						'2xl': 'repeat(4, 1fr)',
					}}
					gap={3}
				>
					<DatePickerLabel
						label={t('components.sellingInvoices.drawer.invoiceDate')}
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
							{t('components.sellingInvoices.drawer.invoiceTime')}
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
						label={t('components.sellingInvoices.drawer.salesPerson')}
						options={[{ label: draft.salesPerson, value: draft.salesPerson }]}
						selectedOptions={[
							{ label: draft.salesPerson, value: draft.salesPerson },
						]}
						onSelect={values =>
							setDraft(current => ({
								...current,
								salesPerson: values[0] ?? current.salesPerson,
							}))
						}
						placeholder={t('components.sellingInvoices.drawer.salesPerson')}
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
						label={t('components.sellingInvoices.drawer.customer')}
						options={customerOptions.map(customer => ({
							label: customer.name,
							value: customer.customerId,
						}))}
						selectedOptions={[
							{ label: draft.customerName, value: draft.customerId },
						]}
						onSelect={values => handleCustomerChange(values[0] ?? '')}
						placeholder={t('components.sellingInvoices.drawer.customer')}
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
						{t('components.sellingInvoices.drawer.paymentType')}
					</Text>
					<HStack spacing={2}>
						<PaymentTypeButton
							type="cash"
							label={t('components.sellingInvoices.paymentType.cash')}
							icon={<AsDollarSignIcon fill="none" />}
							isActive={draft.paymentType === 'cash'}
							onClick={handlePaymentTypeChange}
							isDisabled={isReadOnly}
						/>
						{/* <PaymentTypeButton
							type="card"
							label={t('components.sellingInvoices.paymentType.card')}
							icon={<AsCreditCardIcon />}
							isActive={draft.paymentType === 'card'}
							onClick={handlePaymentTypeChange}
						/> */}
						<PaymentTypeButton
							type="credit"
							label={t('components.sellingInvoices.paymentType.credit')}
							icon={<AsPriceTagIcon fill="none" />}
							isActive={draft.paymentType === 'credit'}
							onClick={handlePaymentTypeChange}
							isDisabled={isReadOnly}
						/>
					</HStack>
				</Box>

				{!isReadOnly && (
					<Box>
						<InvoiceProductSearch
							onAddProduct={handleAddProduct}
							initialSearch={initialProductSearch}
							autoFocus={isActive && mode === 'create'}
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
					invoiceKind="selling"
				/>

				{hasCurrencyOptions && (
					<Box maxW={{ base: '100%', md: '20rem' }}>
						<DropdownLabel
							label={t('components.sellingInvoices.drawer.displayCurrency')}
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
								'components.sellingInvoices.drawer.displayCurrency',
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
						{/* TODO: Update the note section to use the new note component */}
						{showNote ? (
							<Button
								variant="link"
								color={PAGE_COLORS.primary}
								fontWeight={600}
								fontSize="sm"
								onClick={() => setShowNote(true)}
							>
								{t('components.sellingInvoices.drawer.addNote')}
							</Button>
						) : (
							<VStack align="stretch" spacing={2}>
								<Text fontSize="sm" fontWeight={600} color="gray.700">
									{t('components.sellingInvoices.drawer.additionalInfo')}
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
										'components.sellingInvoices.drawer.notePlaceholder',
									)}
									borderRadius="lg"
									borderColor={PAGE_COLORS.border}
									rows={3}
									isReadOnly={isReadOnly}
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
									{t('components.sellingInvoices.drawer.subtotal')}
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
									{t('components.sellingInvoices.drawer.discount')}
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
									{t('components.sellingInvoices.drawer.tax')}
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
										{t('components.sellingInvoices.drawer.grandTotal')}
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
									{t('components.sellingInvoices.drawer.paidAmount')}
								</Text>
								<CurrencyAmountTooltip
									amount={draft.paidAmount}
									displayText={formatAmount(draft.paidAmount)}
									options={displayCurrencyOptions}
									displayCurrencyId={displayCurrencyId}
									fontSize="xl"
									fontWeight={700}
									onEdit={
										isReadOnly || draft.paymentType === 'credit'
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
									{t('components.sellingInvoices.drawer.change')}
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
						{mode === 'edit' ? (
							<>
								<Button
									variant="outline"
									borderRadius="lg"
									borderColor={PAGE_COLORS.border}
									flex={{ base: 1, sm: 'none' }}
									onClick={onClose}
								>
									{t('common.cancel')}
								</Button>
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
									borderRadius="lg"
									fontWeight={600}
									flex={1}
									_hover={{ bg: '#1D4ED8' }}
									isDisabled={
										draft.lineItems.length === 0 ||
										(draft.paymentType === 'credit' &&
											draft.customerId === WALK_IN_CUSTOMER_ID)
									}
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
									{t('components.sellingInvoices.drawer.saveChanges')}
								</Button>
							</>
						) : (
							<>
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
									isDisabled={draft.lineItems.length === 0}
								>
									{t('components.sellingInvoices.drawer.saveDraft')}
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
									isDisabled={draft.lineItems.length === 0}
								>
									{t('components.sellingInvoices.drawer.holdInvoice')}
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
											isDisabled={
												draft.lineItems.length === 0 ||
												(draft.paymentType === 'credit' &&
													draft.customerId === WALK_IN_CUSTOMER_ID)
											}
										>
											<ChevronDownIcon />
										</MenuButton>
										<MenuList>
											<MenuItem>
												{t('components.sellingInvoices.drawer.saveDraft')}
											</MenuItem>
											<MenuItem>
												{t('components.sellingInvoices.drawer.holdInvoice')}
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
										isDisabled={
											draft.lineItems.length === 0 ||
											(draft.paymentType === 'credit' &&
												draft.customerId === WALK_IN_CUSTOMER_ID)
										}
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
											? t('components.sellingInvoices.drawer.payCashAndSave')
											: draft.paymentType === 'card'
												? t('components.sellingInvoices.drawer.payCardAndSave')
												: t(
														'components.sellingInvoices.drawer.saveCreditInvoice',
													)}
									</Button>
								</HStack>
							</>
						)}
					</Flex>
				)}
			</Box>
		</Box>
	)
}

export default NewSellingInvoicePanel
