import {
	Badge,
	Box,
	Button,
	Flex,
	HStack,
	Icon,
	IconButton,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Spinner,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
	useDisclosure,
} from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon } from '@chakra-ui/icons'

import {
	useDeleteBuyingInvoiceMutation,
	useDeleteDailyActionMutation,
	useDeleteSellingInvoiceMutation,
	useGetBuyingInvoicesQuery,
	useGetCustomersQuery,
	useGetSellingInvoicesQuery,
	useGetSingleProjectQuery,
	useGetSuppliersQuery,
	useUpdateProjectMutation,
} from '../../api/apiStore'
import { AsDownloadIcon } from '../../icons/Download'
import { AsPrintIcon } from '../../icons/Print'
import { AsTrashIcon } from '../../icons/Trash'
import { InvoiceUiStatus, PricingLabelsType } from '../../shared/globalEnums'
import { AsEditIcon } from '../../shared/icons/Edit'
import { AsWatcherEyeIcon } from '../../shared/icons/WatcherEye'
import { useSee } from '../../shared/hooks/useSee'
import { useWarehouseScope } from '../../shared/hooks/useWarehouseScope'
import { SEE } from '../../shared/seeFlags'
import type { ApiBuyingInvoice } from '../BuyingInvoice/buyingInvoiceApiMappers'
import { mapApiBuyingInvoiceToTableRow } from '../BuyingInvoice/buyingInvoiceApiMappers'
import BuyingInvoiceDetailModal from '../BuyingInvoice/BuyingInvoiceDetailModal'
import type { BuyingInvoicePanelMode } from '../BuyingInvoice/NewBuyingInvoicePanel'
import ConfirmationDialog from '../ConfirmationDialog'
import {
	ENTRY_KIND_BADGE,
	INVOICE_KIND_BADGE,
	INVOICES_PER_PAGE,
	PAGE_COLORS,
	PAYMENT_TYPE_CONFIG,
	PaymentTypeIcon,
	STATUS_CONFIG,
} from '../SellingInvoice/constants'
import {
	convertEntryAmountToPrimary,
	convertPrimaryAmount,
	convertToPrimaryAmount,
	formatDisplayAmount,
	formatEntryAmountForDisplay,
	formatInvoiceAmountForDisplay,
} from '../SellingInvoice/currencyDisplay'
import CurrencyAmountTooltip from '../SellingInvoice/CurrencyAmountTooltip'
import type { InvoicePanelMode } from '../SellingInvoice/NewSellingInvoicePanel'
import InvoiceDetailModal from '../SellingInvoice/InvoiceDetailModal'
import {
	mapApiInvoiceToSellingInvoice,
	type ApiSellingInvoice,
} from '../SellingInvoice/invoiceApiMappers'
import QuickEntryModal, {
	type QuickEntryModalMode,
} from '../SellingInvoice/QuickEntryModal'
import type { SellingInvoiceStatus } from '../SellingInvoice/types'
import { useInvoiceDisplayCurrency } from '../SellingInvoice/useInvoiceDisplayCurrency'
import { useInvoiceDocumentExport } from '../SellingInvoice/useInvoiceDocumentExport'
import { getApiErrorMessage } from '../../offline/getApiErrorMessage'
import { parseNumberValue } from '../../shared/numberParse'
import {
	compareLanguage,
	formatNumber,
	formatNumberForDb,
} from '../../shared/utils'

import { documentNameStyles } from '../../theme/styles'
import InputLabel from './InputLabel'
import useCustomToast from './CustomToast'
import {
	buildPartyActivityRows,
	formatPartyActivityWhen,
	isQuickEntryActivity,
	partyActivityBalanceAmount,
	partyActivityBalanceTone,
	partyCashEntries,
	partyInvoiceActivity,
	type PartyActivity,
	type PartyActivityFilter,
} from './partyActivityRows'

const FILTERS = [
	'all',
	InvoiceUiStatus.PAID,
	InvoiceUiStatus.CREDIT,
	InvoiceUiStatus.PARTIAL,
	'entries',
] as const

const signedBalanceText = (balance: number, displayText: string) => {
	const tone = partyActivityBalanceTone(balance)
	return {
		text: tone.sign ? `${tone.sign}${displayText}` : displayText,
		color: tone.color,
	}
}

const StatusBadge = ({ status }: { status: SellingInvoiceStatus }) => {
	const { t } = useTranslation()
	const config = STATUS_CONFIG[status]

	return (
		<Badge
			px={3}
			py={1}
			borderRadius="full"
			fontSize="xs"
			fontWeight={600}
			bg={config.bg}
			color={config.color}
			textTransform="none"
		>
			{t(config.labelKey)}
		</Badge>
	)
}

interface PartyActivityTableProps {
	party: 'customer' | 'supplier' | 'partner' | 'project'
	partyId: string
	partyName: string
	entries: DailyAction[]
	sellingInvoices?: ApiSellingInvoice[]
	buyingInvoices?: ApiBuyingInvoice[]
}

const PartyActivityTable = ({
	party,
	partyId,
	partyName,
	entries,
	sellingInvoices,
	buyingInvoices,
}: PartyActivityTableProps) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const { canSee } = useSee()
	const { isOperational } = useWarehouseScope()
	const canAddSelling = canSee(SEE.sellingInvoicesSellingButton)
	const canEditSelling = canSee(SEE.sellingInvoicesEdit)
	const canDeleteSelling = canSee(SEE.sellingInvoicesDelete)
	const canAddBuying = canSee(SEE.invoicesBuyingAdd)
	const canEditBuying = canSee(SEE.invoicesBuyingEdit)
	const canDeleteBuying = canSee(SEE.invoicesBuyingDelete)
	const canAddEntry = canSee(SEE.invoicesEntriesAdd)
	const canEditEntry = canSee(SEE.invoicesEntriesEdit)
	const canDeleteEntry = canSee(SEE.invoicesEntriesDelete)
	const canSeeWholesalePrice = canSee(SEE.productsWholesalePrice)
	const canSeeSemiWholesalePrice = canSee(SEE.productsSemiWholesalePrice)
	const canSetContractCost = party === 'project' && canSee(SEE.projectsAdd)
	const [filter, setFilter] = useState<PartyActivityFilter>('all')
	const [currentPage, setCurrentPage] = useState(1)
	const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null)
	const [detailKind, setDetailKind] = useState<'selling' | 'buying'>('selling')
	const [detailMode, setDetailMode] =
		useState<Extract<InvoicePanelMode, 'view' | 'edit'>>('view')
	const [buyingDetailMode, setBuyingDetailMode] =
		useState<Extract<BuyingInvoicePanelMode, 'view' | 'edit'>>('view')
	const [selectedEntry, setSelectedEntry] = useState<DailyAction | null>(null)
	const [entryMode, setEntryMode] = useState<QuickEntryModalMode>('view')
	const [invoicePendingDelete, setInvoicePendingDelete] = useState<{
		id: string
		kind: 'selling' | 'buying'
	} | null>(null)
	const [entryPendingDelete, setEntryPendingDelete] = useState<string | null>(
		null,
	)
	const [createInvoice, setCreateInvoice] = useState<
		'selling' | 'buying' | null
	>(null)
	const [invoicePricing, setInvoicePricing] = useState(
		PricingLabelsType.RETAIL_PRICE,
	)
	const [costKind, setCostKind] = useState<'employee' | 'other' | undefined>()
	const {
		isOpen: isSellingOpen,
		onOpen: onSellingOpen,
		onClose: onSellingClose,
	} = useDisclosure()
	const {
		isOpen: isBuyingOpen,
		onOpen: onBuyingOpen,
		onClose: onBuyingClose,
	} = useDisclosure()
	const {
		isOpen: isEntryOpen,
		onOpen: onEntryOpen,
		onClose: onEntryClose,
	} = useDisclosure()
	const {
		isOpen: isContractCostOpen,
		onOpen: onContractCostOpen,
		onClose: onContractCostClose,
	} = useDisclosure()
	const { data: projectDetail } = useGetSingleProjectQuery(partyId, {
		skip: party !== 'project',
	})

	const invoiceStatus =
		filter === 'all' || filter === 'entries' ? undefined : filter
	const sellingCustomerId = party === 'customer' ? partyId : undefined
	const buyingSupplierId = party === 'supplier' ? partyId : undefined
	const skipSelling =
		sellingInvoices != null || !sellingCustomerId || filter === 'entries'
	const skipBuying =
		buyingInvoices != null || !buyingSupplierId || filter === 'entries'

	const {
		data: sellingResponse,
		isLoading: isSellingLoading,
		isFetching: isSellingFetching,
		isError: isSellingError,
	} = useGetSellingInvoicesQuery(
		{ customerId: sellingCustomerId, status: invoiceStatus },
		{ skip: skipSelling },
	)
	const {
		data: buyingResponse,
		isLoading: isBuyingLoading,
		isFetching: isBuyingFetching,
		isError: isBuyingError,
	} = useGetBuyingInvoicesQuery(
		{ supplierId: buyingSupplierId, status: invoiceStatus },
		{ skip: skipBuying },
	)
	const { data: sellingCreateMeta, isError: isSellingCreateError } =
		useGetSellingInvoicesQuery(undefined, {
			skip:
				createInvoice !== 'selling' ||
				sellingResponse?.nextInvoiceNumber != null,
		})
	const { data: buyingCreateMeta, isError: isBuyingCreateError } =
		useGetBuyingInvoicesQuery(undefined, {
			skip:
				createInvoice !== 'buying' || buyingResponse?.nextInvoiceNumber != null,
		})
	const needsCustomers =
		createInvoice === 'selling' ||
		(isSellingOpen && detailMode !== 'view') ||
		(isEntryOpen && entryMode !== 'view')
	const needsSuppliers =
		createInvoice === 'buying' ||
		(isBuyingOpen && buyingDetailMode !== 'view') ||
		(isEntryOpen && entryMode !== 'view')
	const { data: customers = [] } = useGetCustomersQuery(undefined, {
		skip: !needsCustomers,
		refetchOnMountOrArgChange: false,
	})
	const { data: suppliers = [] } = useGetSuppliersQuery(
		{},
		{ skip: !needsSuppliers, refetchOnMountOrArgChange: false },
	)
	const [deleteSellingInvoice, { isLoading: isDeletingSelling }] =
		useDeleteSellingInvoiceMutation()
	const [deleteBuyingInvoice, { isLoading: isDeletingBuying }] =
		useDeleteBuyingInvoiceMutation()
	const [deleteDailyAction, { isLoading: isDeletingEntry }] =
		useDeleteDailyActionMutation()
	const { isExporting, printInvoice, downloadInvoice } =
		useInvoiceDocumentExport()
	const { options: displayCurrencyOptions, displayCurrencyId } =
		useInvoiceDisplayCurrency()

	const sellingRows = useMemo(
		() =>
			(sellingInvoices ?? sellingResponse?.invoices ?? []).map(invoice => {
				const apiInvoice = invoice as ApiSellingInvoice
				return partyInvoiceActivity(
					'selling',
					mapApiInvoiceToSellingInvoice(apiInvoice),
					apiInvoice.issuedAt ?? apiInvoice.createdAt,
				)
			}),
		[sellingInvoices, sellingResponse?.invoices],
	)
	const buyingRows = useMemo(
		() =>
			(buyingInvoices ?? buyingResponse?.invoices ?? []).map(invoice => {
				const apiInvoice = invoice as ApiBuyingInvoice
				return partyInvoiceActivity(
					'buying',
					mapApiBuyingInvoiceToTableRow(apiInvoice),
					apiInvoice.issuedAt ?? apiInvoice.createdAt,
				)
			}),
		[buyingInvoices, buyingResponse?.invoices],
	)
	const entryRows = useMemo(() => partyCashEntries(entries), [entries])
	const rows = useMemo(
		() => buildPartyActivityRows(sellingRows, buyingRows, entryRows, filter),
		[sellingRows, buyingRows, entryRows, filter],
	)

	const totalCount = rows.length
	const totalPages = Math.max(1, Math.ceil(totalCount / INVOICES_PER_PAGE))
	const pageRows = useMemo(() => {
		const start = (currentPage - 1) * INVOICES_PER_PAGE
		return rows.slice(start, start + INVOICES_PER_PAGE)
	}, [rows, currentPage])
	const startIndex =
		totalCount === 0 ? 0 : (currentPage - 1) * INVOICES_PER_PAGE + 1
	const endIndex = Math.min(currentPage * INVOICES_PER_PAGE, totalCount)

	const showInitialLoader =
		(!skipSelling && isSellingLoading && !sellingResponse) ||
		(!skipBuying && isBuyingLoading && !buyingResponse)
	const showInvoiceError =
		(!skipSelling && isSellingError) || (!skipBuying && isBuyingError)
	const showRefetchOverlay =
		!showInitialLoader &&
		((!skipSelling && isSellingFetching) || (!skipBuying && isBuyingFetching))

	const openInvoice = (
		invoiceId: string,
		kind: 'selling' | 'buying',
		mode: 'view' | 'edit',
	) => {
		if (kind === 'selling' && mode === 'edit' && !canEditSelling) return
		if (kind === 'buying' && mode === 'edit' && !canEditBuying) return
		setDetailInvoiceId(invoiceId)
		setDetailKind(kind)
		if (kind === 'buying') {
			setBuyingDetailMode(mode)
			onBuyingOpen()
			return
		}
		setDetailMode(mode)
		onSellingOpen()
	}

	const closeInvoice = () => {
		setDetailInvoiceId(null)
		setDetailMode('view')
		setBuyingDetailMode('view')
		onSellingClose()
		onBuyingClose()
	}

	const sellingNextNumber =
		sellingResponse?.nextInvoiceNumber ?? sellingCreateMeta?.nextInvoiceNumber
	const buyingNextNumber =
		buyingResponse?.nextInvoiceNumber ?? buyingCreateMeta?.nextInvoiceNumber
	const blockedTitle = isOperational
		? undefined
		: t('components.topBar.warehouseScopePostingBlocked')

	const openCreateEntry = () => {
		if (!canAddEntry || !isOperational) return
		setCostKind(undefined)
		setSelectedEntry(null)
		setEntryMode('create')
		onEntryOpen()
	}

	const openCost = (kind: 'employee' | 'other') => {
		if (!canAddEntry || !isOperational) return
		setCostKind(kind)
		setSelectedEntry(null)
		setEntryMode('create')
		onEntryOpen()
	}

	const openSellingInvoice = (pricing = PricingLabelsType.RETAIL_PRICE) => {
		setInvoicePricing(pricing)
		setCreateInvoice('selling')
	}

	const openEntry = (entry: DailyAction, mode: QuickEntryModalMode) => {
		if (mode === 'edit' && !canEditEntry) return
		setSelectedEntry(entry)
		setEntryMode(mode)
		onEntryOpen()
	}

	const confirmDeleteInvoice = async () => {
		if (!invoicePendingDelete) return

		try {
			if (invoicePendingDelete.kind === 'buying') {
				await deleteBuyingInvoice(invoicePendingDelete.id).unwrap()
			} else {
				await deleteSellingInvoice(invoicePendingDelete.id).unwrap()
			}

			if (detailInvoiceId === invoicePendingDelete.id) closeInvoice()
		} catch {
			showToastMessage({
				status: 'error',
				description: t('components.sellingInvoices.actions.deleteFailed'),
			})
		} finally {
			setInvoicePendingDelete(null)
		}
	}

	const confirmDeleteEntry = async () => {
		if (!entryPendingDelete) return

		try {
			await deleteDailyAction([entryPendingDelete]).unwrap()
			if (
				selectedEntry &&
				(selectedEntry.actionId === entryPendingDelete ||
					selectedEntry._id === entryPendingDelete)
			) {
				setSelectedEntry(null)
				onEntryClose()
			}
		} catch {
			showToastMessage({
				status: 'error',
				description: t('components.daily.confirmations.deleteDailyActionError'),
			})
		} finally {
			setEntryPendingDelete(null)
		}
	}

	const renderActions = (row: PartyActivity) => {
		if (row.kind === 'entry') {
			const canOpenEntry = isQuickEntryActivity(row.row)
			return (
				<HStack spacing={1}>
					{canOpenEntry ? (
						<IconButton
							size="xs"
							variant="ghost"
							aria-label={t('components.sellingInvoices.actions.view')}
							icon={
								<Icon
									as={AsWatcherEyeIcon}
									color={PAGE_COLORS.primary}
									boxSize={5}
								/>
							}
							onClick={event => {
								event.stopPropagation()
								openEntry(row.source, 'view')
							}}
						/>
					) : null}
					{canOpenEntry && canEditEntry ? (
						<IconButton
							size="xs"
							variant="ghost"
							aria-label={t('components.sellingInvoices.actions.edit')}
							icon={
								<Icon as={AsEditIcon} color={PAGE_COLORS.primary} boxSize={5} />
							}
							onClick={event => {
								event.stopPropagation()
								openEntry(row.source, 'edit')
							}}
						/>
					) : null}
					{canDeleteEntry ? (
						<IconButton
							size="xs"
							variant="ghost"
							aria-label={t('components.sellingInvoices.actions.delete')}
							icon={
								<Icon
									as={AsTrashIcon}
									fill="none"
									color={PAGE_COLORS.danger}
									boxSize={5}
								/>
							}
							onClick={event => {
								event.stopPropagation()
								setEntryPendingDelete(row.row.id)
							}}
						/>
					) : null}
				</HStack>
			)
		}

		const canEdit = row.kind === 'buying' ? canEditBuying : canEditSelling
		const canDelete = row.kind === 'buying' ? canDeleteBuying : canDeleteSelling

		return (
			<HStack spacing={1}>
				<IconButton
					size="xs"
					variant="ghost"
					aria-label={t('components.sellingInvoices.actions.view')}
					icon={
						<Icon
							as={AsWatcherEyeIcon}
							color={PAGE_COLORS.primary}
							boxSize={5}
						/>
					}
					onClick={event => {
						event.stopPropagation()
						openInvoice(row.invoice.id, row.kind, 'view')
					}}
				/>
				{canEdit ? (
					<IconButton
						size="xs"
						variant="ghost"
						aria-label={t('components.sellingInvoices.actions.edit')}
						icon={
							<Icon as={AsEditIcon} color={PAGE_COLORS.primary} boxSize={5} />
						}
						onClick={event => {
							event.stopPropagation()
							openInvoice(row.invoice.id, row.kind, 'edit')
						}}
					/>
				) : null}
				{canDelete ? (
					<IconButton
						size="xs"
						variant="ghost"
						aria-label={t('components.sellingInvoices.actions.delete')}
						icon={
							<Icon
								as={AsTrashIcon}
								fill="none"
								color={PAGE_COLORS.danger}
								boxSize={5}
							/>
						}
						onClick={event => {
							event.stopPropagation()
							setInvoicePendingDelete({
								id: row.invoice.id,
								kind: row.kind,
							})
						}}
					/>
				) : null}
				<IconButton
					size="xs"
					variant="ghost"
					aria-label={t('components.sellingInvoices.actions.print')}
					isDisabled={isExporting}
					icon={
						<Icon as={AsPrintIcon} color={PAGE_COLORS.primary} boxSize={5} />
					}
					onClick={event => {
						event.stopPropagation()
						printInvoice(row.invoice.id, row.kind)
					}}
				/>
				<IconButton
					size="xs"
					variant="ghost"
					aria-label={t('components.sellingInvoices.actions.download')}
					isDisabled={isExporting}
					icon={
						<Icon as={AsDownloadIcon} color={PAGE_COLORS.primary} boxSize={5} />
					}
					onClick={event => {
						event.stopPropagation()
						downloadInvoice(row.invoice.id, row.kind)
					}}
				/>
			</HStack>
		)
	}

	return (
		<Box position="relative">
			<Box
				bg="white"
				borderRadius="xl"
				border="1px solid"
				borderColor={PAGE_COLORS.border}
				boxShadow={PAGE_COLORS.cardShadow}
				overflow="hidden"
				minHeight="20rem"
			>
				<Box
					p={{ base: 4, md: 5 }}
					borderBottom="1px solid"
					borderColor={PAGE_COLORS.border}
				>
					<Flex
						direction={{ base: 'column', md: 'row' }}
						gap={3}
						justify="space-between"
						align={{ base: 'stretch', md: 'center' }}
						mb={3}
					>
						<HStack spacing={2}>
							<Text fontSize="lg" fontWeight={700} color="gray.900">
								{t('components.customer.invoices')}
							</Text>
							<Badge
								bg="#DBEAFE"
								color={PAGE_COLORS.primary}
								borderRadius="full"
								px={2.5}
								py={0.5}
								fontSize="xs"
								fontWeight={700}
							>
								{totalCount}
							</Badge>
						</HStack>
						<HStack spacing={2} flexWrap="wrap" justify="flex-end">
							{canAddBuying && party !== 'project' ? (
								<Button
									size="sm"
									variant="outline"
									borderColor={PAGE_COLORS.border}
									fontWeight={600}
									onClick={() => setCreateInvoice('buying')}
									isDisabled={!isOperational}
									title={blockedTitle}
								>
									{t('components.sellingInvoices.newBuyingInvoice')}
								</Button>
							) : null}
							{canSetContractCost ? (
								<Button
									size="sm"
									variant="outline"
									borderColor={PAGE_COLORS.border}
									fontWeight={600}
									onClick={onContractCostOpen}
								>
									{t('components.invoiceSummary.contractCost')}
								</Button>
							) : null}
							{canAddEntry ? (
								<Button
									size="sm"
									variant="outline"
									borderColor={PAGE_COLORS.border}
									fontWeight={600}
									onClick={openCreateEntry}
									isDisabled={!isOperational}
									title={blockedTitle}
								>
									{t('components.sellingInvoices.newEntry')}
								</Button>
							) : null}
							{canAddEntry && party === 'project' ? (
								<>
									<Button
										size="sm"
										variant="outline"
										borderColor={PAGE_COLORS.border}
										fontWeight={600}
										onClick={() => openCost('employee')}
										isDisabled={!isOperational}
										title={blockedTitle}
									>
										{t('components.sellingInvoices.employeeCost')}
									</Button>
									<Button
										size="sm"
										variant="outline"
										borderColor={PAGE_COLORS.border}
										fontWeight={600}
										onClick={() => openCost('other')}
										isDisabled={!isOperational}
										title={blockedTitle}
									>
										{t('components.sellingInvoices.otherCost')}
									</Button>
								</>
							) : null}
							{canAddSelling && party === 'project' ? (
								<HStack spacing={0}>
									{(canSeeWholesalePrice || canSeeSemiWholesalePrice) && (
										<Menu>
											<MenuButton
												as={Button}
												size="sm"
												bg={PAGE_COLORS.primary}
												color="white"
												borderTopLeftRadius={0}
												borderBottomLeftRadius={0}
												borderTopRightRadius="md"
												borderBottomRightRadius="md"
												minW="auto"
												px={2}
												borderLeft="1px solid"
												borderColor="#1D4ED8"
												_hover={{ bg: '#1D4ED8' }}
												aria-label={t(
													'components.sellingInvoices.newInvoiceOptions',
												)}
												isDisabled={!isOperational}
											>
												<ChevronDownIcon />
											</MenuButton>
											<MenuList>
												{canSeeWholesalePrice && (
													<MenuItem
														onClick={() =>
															openSellingInvoice(
																PricingLabelsType.WHOLESALE_PRICE,
															)
														}
													>
														{t(
															'components.sellingInvoices.newWholesaleInvoice',
														)}
													</MenuItem>
												)}
												{canSeeSemiWholesalePrice && (
													<MenuItem
														onClick={() =>
															openSellingInvoice(
																PricingLabelsType.SEMI_WHOLESALE_PRICE,
															)
														}
													>
														{t(
															'components.sellingInvoices.newSemiWholesaleInvoice',
														)}
													</MenuItem>
												)}
											</MenuList>
										</Menu>
									)}
									<Button
										size="sm"
										bg={PAGE_COLORS.primary}
										color="white"
										fontWeight={600}
										borderTopLeftRadius="md"
										borderBottomLeftRadius="md"
										borderTopRightRadius={
											canSeeWholesalePrice || canSeeSemiWholesalePrice
												? 0
												: 'md'
										}
										borderBottomRightRadius={
											canSeeWholesalePrice || canSeeSemiWholesalePrice
												? 0
												: 'md'
										}
										_hover={{ bg: '#1D4ED8' }}
										onClick={() => openSellingInvoice()}
										isDisabled={!isOperational}
										title={blockedTitle}
									>
										{t('components.sellingInvoices.newInvoice')}
									</Button>
								</HStack>
							) : canAddSelling ? (
								<Button
									size="sm"
									bg={PAGE_COLORS.primary}
									color="white"
									fontWeight={600}
									_hover={{ bg: '#1D4ED8' }}
									onClick={() => openSellingInvoice()}
									isDisabled={!isOperational}
									title={blockedTitle}
								>
									{t('components.sellingInvoices.newInvoice')}
								</Button>
							) : null}
						</HStack>
					</Flex>
					<Flex gap={2} flexWrap="wrap">
						{FILTERS.map(tab => {
							const isActive = filter === tab
							return (
								<Button
									key={tab}
									size="sm"
									fontSize="sm"
									px={4}
									bg={isActive ? PAGE_COLORS.primary : 'white'}
									color={isActive ? 'white' : PAGE_COLORS.muted}
									border="1px solid"
									borderColor={
										isActive ? PAGE_COLORS.primary : PAGE_COLORS.border
									}
									_hover={{
										bg: isActive ? PAGE_COLORS.primary : 'gray.50',
									}}
									onClick={() => {
										setFilter(tab)
										setCurrentPage(1)
									}}
								>
									{tab === 'entries'
										? t('components.sellingInvoices.newEntry')
										: t(`components.sellingInvoices.status.${tab}`)}
								</Button>
							)
						})}
					</Flex>
				</Box>

				{showInitialLoader ? (
					<Flex justify="center" py={10}>
						<Spinner color={PAGE_COLORS.primary} />
					</Flex>
				) : (
					<>
						{showRefetchOverlay && (
							<Flex
								position="absolute"
								inset={0}
								align="center"
								justify="center"
								bg="whiteAlpha.700"
								zIndex={1}
								pointerEvents="none"
							>
								<Spinner color={PAGE_COLORS.primary} size="sm" />
							</Flex>
						)}
						<Box overflowX="auto">
							<Table variant="simple" size="sm">
								<Thead bg="gray.50">
									<Tr>
										<Th whiteSpace="nowrap">#</Th>
										<Th whiteSpace="nowrap">
											{t('components.sellingInvoices.columns.invoiceNumber')}
										</Th>

										<Th whiteSpace="nowrap">
											{t('components.sellingInvoices.columns.time')}
										</Th>
										<Th whiteSpace="nowrap">
											{t('components.sellingInvoices.columns.status')}
										</Th>
										<Th whiteSpace="nowrap">
											{t('components.sellingInvoices.columns.paymentType')}
										</Th>
										<Th isNumeric whiteSpace="nowrap">
											{t('components.sellingInvoices.columns.total')}
										</Th>
										<Th isNumeric whiteSpace="nowrap">
											{t('components.sellingInvoices.columns.paid')}
										</Th>
										<Th isNumeric whiteSpace="nowrap">
											{t('components.sellingInvoices.columns.due')}
										</Th>
										<Th isNumeric whiteSpace="nowrap">
											{t('components.sellingInvoices.columns.balance')}
										</Th>
										<Th whiteSpace="nowrap">
											{t('components.sellingInvoices.columns.actions')}
										</Th>
									</Tr>
								</Thead>
								<Tbody>
									{showInvoiceError && pageRows.length === 0 ? (
										<Tr>
											<Td colSpan={10} py={10} textAlign="center">
												<Text color={PAGE_COLORS.muted}>
													{t('components.sellingInvoices.loadFailed')}
												</Text>
											</Td>
										</Tr>
									) : pageRows.length === 0 ? (
										<Tr>
											<Td colSpan={10} py={10} textAlign="center">
												<Text color={PAGE_COLORS.muted}>
													{t('components.sellingInvoices.empty')}
												</Text>
											</Td>
										</Tr>
									) : (
										pageRows.map(row => {
											if (row.kind === 'entry') {
												const entryBadge =
													ENTRY_KIND_BADGE[row.row.entrySubType]
												const entryPrimaryAmount = convertEntryAmountToPrimary(
													row.row.amount,
													row.row.currencyId,
													displayCurrencyOptions,
												)
												const entryDisplayText = formatEntryAmountForDisplay(
													row.row.amount,
													row.row.currencyId,
													displayCurrencyId,
													displayCurrencyOptions,
												)
												const entryBalance = partyActivityBalanceAmount(
													party,
													row,
													entryPrimaryAmount,
												)
												const entryBalanceText = signedBalanceText(
													entryBalance,
													formatDisplayAmount(
														Math.abs(entryBalance),
														displayCurrencyId,
														displayCurrencyOptions,
													),
												)
												return (
													<Tr
														key={`entry-${row.row.id}`}
														_hover={
															isQuickEntryActivity(row.row)
																? { bg: 'gray.50', cursor: 'pointer' }
																: undefined
														}
														onClick={
															isQuickEntryActivity(row.row)
																? () => openEntry(row.source, 'view')
																: undefined
														}
													>
														<Td>
															<Badge
																px={2.5}
																py={0.5}
																borderRadius="md"
																fontSize="xs"
																fontWeight={700}
																bg={entryBadge.bg}
																color={entryBadge.color}
																textTransform="none"
															>
																{t(entryBadge.labelKey)}
															</Badge>
														</Td>
														<Td color={PAGE_COLORS.muted}>—</Td>
														<Td color={PAGE_COLORS.muted} whiteSpace="nowrap">
															{formatPartyActivityWhen(
																row.sortKey,
																row.row.time,
															)}
														</Td>
														<Td color={PAGE_COLORS.muted}>—</Td>
														<Td color={PAGE_COLORS.muted}>—</Td>
														<Td isNumeric fontWeight={500} color="gray.900">
															<CurrencyAmountTooltip
																amount={entryPrimaryAmount}
																displayText={entryDisplayText}
																options={displayCurrencyOptions}
																displayCurrencyId={displayCurrencyId}
																fontWeight={500}
																color="gray.900"
															/>
														</Td>
														<Td isNumeric color={PAGE_COLORS.muted}>
															—
														</Td>
														<Td isNumeric color={PAGE_COLORS.muted}>
															—
														</Td>
														<Td
															isNumeric
															fontWeight={600}
															color={entryBalanceText.color}
														>
															<CurrencyAmountTooltip
																amount={entryBalance}
																displayText={entryBalanceText.text}
																options={displayCurrencyOptions}
																displayCurrencyId={displayCurrencyId}
																fontWeight={600}
																color={entryBalanceText.color}
															/>
														</Td>
														<Td>{renderActions(row)}</Td>
													</Tr>
												)
											}

											const invoice = row.invoice
											const paymentConfig =
												PAYMENT_TYPE_CONFIG[invoice.paymentType]
											const kindBadge = INVOICE_KIND_BADGE[row.kind]
											const invoiceTotalText = formatInvoiceAmountForDisplay(
												invoice.currencyAmounts,
												'amount',
												displayCurrencyId,
												invoice.total,
												displayCurrencyOptions,
											)
											const invoiceBalance = partyActivityBalanceAmount(
												party,
												row,
												0,
											)
											const invoiceBalanceText = signedBalanceText(
												invoiceBalance,
												invoiceBalance === 0
													? formatDisplayAmount(
															0,
															displayCurrencyId,
															displayCurrencyOptions,
														)
													: formatInvoiceAmountForDisplay(
															invoice.currencyAmounts,
															'remainingAmount',
															displayCurrencyId,
															Math.abs(invoiceBalance),
															displayCurrencyOptions,
														),
											)
											return (
												<Tr
													key={`${row.kind}-${invoice.id}`}
													_hover={{ bg: 'gray.50', cursor: 'pointer' }}
													onClick={() =>
														openInvoice(invoice.id, row.kind, 'view')
													}
												>
													<Td>
														<Badge
															px={2}
															py={0.5}
															borderRadius="md"
															fontSize="xs"
															fontWeight={700}
															bg={kindBadge.bg}
															color={kindBadge.color}
															textTransform="none"
														>
															{t(kindBadge.labelKey)}
														</Badge>
													</Td>
													<Td>
														<Text fontWeight={600} color="gray.900">
															{invoice.invoiceNumber}
														</Text>
													</Td>
													<Td color={PAGE_COLORS.muted} whiteSpace="nowrap">
														{formatPartyActivityWhen(row.sortKey, invoice.time)}
													</Td>
													<Td>
														<StatusBadge status={invoice.status} />
													</Td>
													<Td>
														<HStack spacing={1.5} color={paymentConfig.color}>
															<PaymentTypeIcon type={invoice.paymentType} />
															<Text
																fontSize="sm"
																fontWeight={500}
																whiteSpace="nowrap"
															>
																{t(paymentConfig.labelKey)}
															</Text>
														</HStack>
													</Td>
													<Td isNumeric fontWeight={500} color="gray.900">
														<CurrencyAmountTooltip
															amount={invoice.total}
															displayText={invoiceTotalText}
															options={displayCurrencyOptions}
															displayCurrencyId={displayCurrencyId}
															savedCurrencyAmounts={invoice.currencyAmounts}
															savedAmountField="amount"
															fontWeight={500}
															color="gray.900"
														/>
													</Td>
													<Td isNumeric color="gray.800">
														<CurrencyAmountTooltip
															amount={invoice.paid}
															displayText={formatInvoiceAmountForDisplay(
																invoice.currencyAmounts,
																'paidAmount',
																displayCurrencyId,
																invoice.paid,
																displayCurrencyOptions,
															)}
															options={displayCurrencyOptions}
															displayCurrencyId={displayCurrencyId}
															savedCurrencyAmounts={invoice.currencyAmounts}
															savedAmountField="paidAmount"
															fontWeight={400}
															color="gray.800"
														/>
													</Td>
													<Td isNumeric>
														<CurrencyAmountTooltip
															amount={invoice.due}
															displayText={formatInvoiceAmountForDisplay(
																invoice.currencyAmounts,
																'remainingAmount',
																displayCurrencyId,
																invoice.due,
																displayCurrencyOptions,
															)}
															options={displayCurrencyOptions}
															displayCurrencyId={displayCurrencyId}
															savedCurrencyAmounts={invoice.currencyAmounts}
															savedAmountField="remainingAmount"
															fontWeight={invoice.due > 0 ? 600 : 400}
															color={
																invoice.due > 0
																	? PAGE_COLORS.danger
																	: 'gray.800'
															}
														/>
													</Td>
													<Td
														isNumeric
														fontWeight={600}
														color={invoiceBalanceText.color}
													>
														<CurrencyAmountTooltip
															amount={invoiceBalance}
															displayText={invoiceBalanceText.text}
															options={displayCurrencyOptions}
															displayCurrencyId={displayCurrencyId}
															savedCurrencyAmounts={
																invoiceBalance === 0
																	? undefined
																	: invoice.currencyAmounts
															}
															savedAmountField={
																invoiceBalance === 0
																	? undefined
																	: 'remainingAmount'
															}
															fontWeight={600}
															color={invoiceBalanceText.color}
														/>
													</Td>
													<Td>{renderActions(row)}</Td>
												</Tr>
											)
										})
									)}
								</Tbody>
							</Table>
						</Box>
						{totalCount > INVOICES_PER_PAGE && (
							<Flex
								p={4}
								justify="space-between"
								align="center"
								borderTop="1px solid"
								borderColor={PAGE_COLORS.border}
							>
								<Text fontSize="sm" color={PAGE_COLORS.muted}>
									{t('components.sellingInvoices.pagination.showing', {
										start: startIndex,
										end: endIndex,
										total: totalCount,
									})}
								</Text>
								<HStack spacing={2}>
									<Button
										size="sm"
										variant="outline"
										isDisabled={currentPage <= 1}
										onClick={() => setCurrentPage(page => page - 1)}
									>
										{t('pagination.previous')}
									</Button>
									<Text fontSize="sm" color={PAGE_COLORS.muted}>
										{t('pagination.pageOf', {
											currentPage,
											totalPages,
										})}
									</Text>
									<Button
										size="sm"
										variant="outline"
										isDisabled={currentPage >= totalPages}
										onClick={() => setCurrentPage(page => page + 1)}
									>
										{t('pagination.next')}
									</Button>
								</HStack>
							</Flex>
						)}
					</>
				)}
			</Box>

			<InvoiceDetailModal
				isOpen={isSellingOpen}
				invoiceId={detailKind === 'selling' ? detailInvoiceId : null}
				invoice={
					detailKind === 'selling'
						? sellingInvoices?.find(
								invoice => invoice.invoiceId === detailInvoiceId,
							)
						: undefined
				}
				mode={detailMode}
				customers={customers}
				onClose={closeInvoice}
				onRequestEdit={canEditSelling ? () => setDetailMode('edit') : undefined}
			/>
			<BuyingInvoiceDetailModal
				isOpen={isBuyingOpen}
				buyingInvoiceId={detailKind === 'buying' ? detailInvoiceId : null}
				invoice={
					detailKind === 'buying'
						? buyingInvoices?.find(
								invoice => invoice.buyingInvoiceId === detailInvoiceId,
							)
						: undefined
				}
				mode={buyingDetailMode}
				suppliers={suppliers}
				onClose={closeInvoice}
				onRequestEdit={
					canEditBuying ? () => setBuyingDetailMode('edit') : undefined
				}
			/>
			<QuickEntryModal
				isOpen={isEntryOpen}
				onClose={() => {
					setSelectedEntry(null)
					setEntryMode('view')
					setCostKind(undefined)
					onEntryClose()
				}}
				mode={entryMode}
				initialEntry={selectedEntry}
				initialPartyId={entryMode === 'create' ? partyId : undefined}
				initialPartyName={entryMode === 'create' ? partyName : undefined}
				initialProjectId={
					entryMode === 'create' && party === 'project' ? partyId : undefined
				}
				costKind={entryMode === 'create' ? costKind : undefined}
				customers={customers}
				suppliers={suppliers}
			/>
			<ContractCostModal
				isOpen={isContractCostOpen}
				onClose={onContractCostClose}
				projectId={partyId}
				contractCost={projectDetail?.invoiceSummary?.contractCost}
			/>
			{createInvoice === 'selling' ? (
				<InvoiceDetailModal
					isOpen
					mode="create"
					customers={customers}
					initialCustomerId={partyId}
					initialCustomerName={partyName}
					initialProjectId={party === 'project' ? partyId : undefined}
					initialPricingLabels={invoicePricing}
					nextInvoiceNumber={
						sellingNextNumber ?? (isSellingCreateError ? 1 : undefined)
					}
					onClose={() => setCreateInvoice(null)}
					onSaved={() => setCreateInvoice(null)}
				/>
			) : null}
			{createInvoice === 'buying' ? (
				<BuyingInvoiceDetailModal
					isOpen
					mode="create"
					suppliers={suppliers}
					initialSupplierId={party === 'project' ? undefined : partyId}
					initialSupplierName={party === 'project' ? undefined : partyName}
					nextInvoiceNumber={
						buyingNextNumber ?? (isBuyingCreateError ? 1 : undefined)
					}
					onClose={() => setCreateInvoice(null)}
					onSaved={() => setCreateInvoice(null)}
				/>
			) : null}
			<ConfirmationDialog
				isOpen={Boolean(invoicePendingDelete)}
				onClose={() => setInvoicePendingDelete(null)}
				onConfirm={confirmDeleteInvoice}
				header={t('components.sellingInvoices.actions.deleteConfirmTitle')}
				body={t('components.sellingInvoices.actions.deleteConfirmBody')}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeletingSelling || isDeletingBuying}
			/>
			<ConfirmationDialog
				isOpen={Boolean(entryPendingDelete)}
				onClose={() => setEntryPendingDelete(null)}
				onConfirm={confirmDeleteEntry}
				header={t('components.daily.confirmations.deleteDailyAction')}
				body={t(
					'components.daily.confirmations.deleteDailyActionConfirmationBody',
				)}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeletingEntry}
			/>
		</Box>
	)
}

const ContractCostModal = ({
	isOpen,
	onClose,
	projectId,
	contractCost,
}: {
	isOpen: boolean
	onClose: () => void
	projectId: string
	contractCost?: number | null
}) => {
	const { t, i18n } = useTranslation()
	const showToast = useCustomToast()
	const { options, displayCurrencyId } = useInvoiceDisplayCurrency()
	const [updateProject, { isLoading }] = useUpdateProjectMutation()
	const [amount, setAmount] = useState('')

	const { isArabic } = compareLanguage(i18n.language)

	useEffect(() => {
		if (!isOpen) return

		if (contractCost == null) {
			setAmount('')
			return
		}

		const display = displayCurrencyId
			? convertPrimaryAmount(contractCost, displayCurrencyId, options)
			: contractCost

		setAmount(formatNumber(display, { maximumDecimals: 2 }) ?? '')
	}, [contractCost, displayCurrencyId, isOpen, options])

	const handleSave = async () => {
		const stored = formatNumberForDb(amount, 2)
		const displayAmount = stored == null ? NaN : Number(stored)

		if (!(displayAmount >= 0)) return

		try {
			await updateProject({
				projectId,
				contractCost: convertToPrimaryAmount(
					displayAmount,
					displayCurrencyId,
					options,
				),
			}).unwrap()
			showToast({
				status: 'success',
				description: t('components.invoiceSummary.contractCostSaved'),
			})
			onClose()
		} catch (error) {
			showToast({
				status: 'error',
				description: getApiErrorMessage(
					error,
					t('components.invoiceSummary.contractCostError'),
				),
			})
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} isCentered>
			<ModalOverlay />
			<ModalContent borderRadius="xl">
				<ModalHeader fontWeight={700}>
					{t('components.invoiceSummary.contractCost')}
				</ModalHeader>
				<ModalCloseButton
					size="lg"
					sx={{
						left: isArabic ? '0.4rem' : 'auto',
						right: isArabic ? 'auto' : '0.4rem',
						marginRight: 0,
					}}
				/>
				<ModalBody>
					<InputLabel
						label={t('common.amount')}
						inputPlaceholder={t('common.amount')}
						inputType="text"
						styles={documentNameStyles}
						value={amount}
						hasCurrency={true}
						currency="$"
						onChange={(value: string) => setAmount(parseNumberValue(value, 2))}
					/>
				</ModalBody>
				<ModalFooter gap={2}>
					<Button variant="outline" onClick={onClose}>
						{t('common.cancel')}
					</Button>
					<Button
						bg={PAGE_COLORS.primary}
						color="white"
						_hover={{ bg: '#1D4ED8' }}
						onClick={handleSave}
						isLoading={isLoading}
						isDisabled={!amount.trim()}
					>
						{t('common.save')}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default PartyActivityTable
