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
import { ChevronDownIcon, CloseIcon } from '@chakra-ui/icons'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	useGetCustomersQuery,
	useGetSellingInvoiceQuery,
	usePostSellingInvoiceMutation,
	useUpdateSellingInvoiceMutation,
} from '../../api/apiStore'
import { useUser } from '../../shared/hooks/useUser'
import { PAGE_COLORS } from './constants'
import { calculateInvoiceTotals } from './invoiceCalculations'
import {
	buildInvoiceRequestBody,
	mapApiInvoiceToDraft,
} from './invoiceApiMappers'
import InvoiceLineItemsTable from './InvoiceLineItemsTable'
import InvoiceProductSearch from './InvoiceProductSearch'
import { addProductToLineItems } from './productLineItem'
import type {
	SellingInvoiceDraft,
	SellingInvoiceLineItem,
	SellingInvoicePaymentType,
} from './types'
import { useInvoiceDisplayCurrency } from './useInvoiceDisplayCurrency'
import CurrencyAmountTooltip from './CurrencyAmountTooltip'
import DropdownLabel from '../DropdownLabel'
import { generateId } from '../../offline/utils'
import { AsDollarSignIcon } from '../../icons/DollarSign'
import { AsPauseIcon } from '../../icons/Pause'
import { AsSaveIcon } from '../icons/Save'
import { AsPriceTagIcon } from '../../shared/icons/PriceTag'
// import { AsCreditCardIcon } from '../../icons/CreditCard'
import { AsDocumentIcon } from '../../shared/icons/Document'
import { AsEditIcon } from '../../shared/icons/Edit'
import DatePickerLabel from '../common/DatePickerLabel'

export type InvoicePanelMode = 'create' | 'view' | 'edit'

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
}

const WALK_IN_CUSTOMER_ID = 'walk-in'

const createInitialDraft = (
	salesPerson: string,
	paymentType: SellingInvoicePaymentType = 'cash',
	invoiceNumber = 1,
): SellingInvoiceDraft => ({
	invoiceId: generateId(),
	invoiceNumber,
	invoiceDate: dayjs().format('YYYY-MM-DD'),
	invoiceTime: dayjs().format('HH:mm'),
	salesPerson,
	customerId: WALK_IN_CUSTOMER_ID,
	customerName: 'Walk-in Customer',
	paymentType,
	lineItems: [],
	note: '',
	paidAmount: 0,
})

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
}: NewSellingInvoicePanelProps) => {
	const { t } = useTranslation()
	const { user } = useUser()
	const { data: customers = [] } = useGetCustomersQuery()
	const [postSellingInvoice, { isLoading: isCreating }] =
		usePostSellingInvoiceMutation()
	const [updateSellingInvoice, { isLoading: isUpdating }] =
		useUpdateSellingInvoiceMutation()
	const [saveError, setSaveError] = useState<string | null>(null)
	const isReadOnly = mode === 'view'
	const isExistingInvoice = mode === 'view' || mode === 'edit'
	const isSaving = isCreating || isUpdating

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

	const [draft, setDraft] = useState<SellingInvoiceDraft>(() =>
		createInitialDraft(
			salesPerson || user?.email || 'User',
			initialPaymentType,
		),
	)
	const [showNote, setShowNote] = useState(false)
	const {
		options: displayCurrencyOptions,
		displayCurrencyId,
		setDisplayCurrencyId,
		formatAmount,
		hasCurrencyOptions,
		currencySettings,
	} = useInvoiceDisplayCurrency()

	useEffect(() => {
		if (!isActive || isExistingInvoice) return

		setDraft({
			...createInitialDraft(
				salesPerson || user?.email || 'User',
				initialPaymentType,
				nextInvoiceNumber,
			),
			customerName: t('components.sellingInvoices.drawer.walkInCustomer'),
		})
		setShowNote(false)
		setSaveError(null)
	}, [
		isActive,
		isExistingInvoice,
		initialPaymentType,
		nextInvoiceNumber,
		salesPerson,
		user?.email,
		t,
	])

	useEffect(() => {
		if (!isActive || !isExistingInvoice || !existingInvoice) return

		setDraft(
			mapApiInvoiceToDraft(
				existingInvoice,
				t('components.sellingInvoices.drawer.walkInCustomer'),
			),
		)
		setShowNote(false)
		setSaveError(null)
	}, [isActive, isExistingInvoice, existingInvoice, t])

	const totals = useMemo(
		() => calculateInvoiceTotals(draft.lineItems),
		[draft.lineItems],
	)

	useEffect(() => {
		if (isReadOnly || draft.paymentType !== 'cash') return

		setDraft(current => ({
			...current,
			paidAmount: calculateInvoiceTotals(current.lineItems).grandTotal,
		}))
	}, [draft.lineItems, draft.paymentType, isReadOnly])

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
		setDraft(current => ({
			...current,
			lineItems: current.lineItems.map(item =>
				item.id === id ? { ...item, ...updates } : item,
			),
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

			onSaved?.()
			onClose()
		} catch (error) {
			const apiError = error as {
				data?: { message?: string; code?: string }
			}
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
				<Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight={700}>
					{t(panelTitleKey)}{' '}
					<Text as="span" color={PAGE_COLORS.primary}>
						#{draft.invoiceNumber}
					</Text>
				</Text>
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
								invoiceDate: date?.toISOString() ?? current.invoiceDate,
							}))
						}
						defaultDate={new Date(draft.invoiceDate)}
						isDisabled
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
								<CurrencyAmountTooltip
									amount={totals.discount}
									displayText={formatAmount(totals.discount)}
									options={displayCurrencyOptions}
									displayCurrencyId={displayCurrencyId}
									fontWeight={500}
								/>
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
