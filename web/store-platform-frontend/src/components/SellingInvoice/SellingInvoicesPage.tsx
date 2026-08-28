import {
	Accordion,
	AccordionButton,
	AccordionIcon,
	AccordionItem,
	AccordionPanel,
	Box,
	Button,
	Flex,
	Heading,
	HStack,
	Icon,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	useDisclosure,
} from '@chakra-ui/react'
import { ChevronDownIcon } from '@chakra-ui/icons'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	useDeleteBuyingInvoiceMutation,
	useDeleteSellingInvoiceMutation,
	useGetBuyingInvoicesQuery,
	useGetCustomersQuery,
	useGetDailyActionsQuery,
	useGetSellingInvoicesQuery,
	useGetSuppliersQuery,
} from '../../api/apiStore'
import type { ApiBuyingInvoice } from '../BuyingInvoice/buyingInvoiceApiMappers'
import { CASH_BALANCE_ALL_TIME_FROM, calculateCashBalance } from './cashBalance'
import type { ApiSellingInvoice } from './invoiceApiMappers'
import { useInvoiceDisplayCurrency } from './useInvoiceDisplayCurrency'
import CustomBreadcrumb from '../CustomBreadcrumb'
import ConfirmationDialog from '../ConfirmationDialog'
import { BreadCrumbItem, InvoicePaymentType } from '../../shared/globalEnums'
import { useUser } from '../../shared/hooks/useUser'
import { useSee } from '../../shared/hooks/useSee'
import { SEE } from '../../shared/seeFlags'
import { generateBreadcrumbs } from '../../shared/routes'
import { pageContentMinHeight } from '../../theme/layout'
import NewBuyingInvoicePanel from '../BuyingInvoice/NewBuyingInvoicePanel'
import BuyingInvoiceDetailModal from '../BuyingInvoice/BuyingInvoiceDetailModal'
import { isBuyingInvoiceDraftSessionDirty } from '../BuyingInvoice/buyingInvoiceDraftSessions'
import type { BuyingInvoiceDraft } from '../BuyingInvoice/types'
import { useBuyingInvoiceDraftSessions } from '../BuyingInvoice/useBuyingInvoiceDraftSessions'
import QuickEntryModal, { type QuickEntryModalMode } from './QuickEntryModal'
import { PAGE_COLORS } from './constants'
import { mapApiSummaryToUi } from './invoiceApiMappers'
import { isDraftSessionDirty } from './invoiceDraftSessions'
import InvoiceBarcodeSearchBar from './InvoiceBarcodeSearchBar'
import InvoiceDetailModal from './InvoiceDetailModal'
import InvoiceSummaryCards from './InvoiceSummaryCards'
import InvoiceTableSection from './InvoiceTableSection'
import NewSellingInvoicePanel, {
	type InvoicePanelMode,
} from './NewSellingInvoicePanel'
import type { SellingInvoiceDraft, SellingInvoicePaymentType } from './types'
import { useInvoiceDraftSessions } from './useInvoiceDraftSessions'
import { normalizeSearchQuery as normalizeBarcode } from './productSearch'
import { AsInvoiceIcon } from '../../icons/Invoice'
import { AsCashBalanceIcon } from '../../icons/CashBalance'
import { AsTrashIcon } from '../../icons/Trash'
import { AsTruckIcon } from '../../shared/icons/Truck'

const styles = {
	wrapper: {
		width: '100%',
		flexDir: 'column',
		minH: pageContentMinHeight,
	},
	title: {
		fontSize: { base: 'xl', md: '1.75rem' },
		fontWeight: '700',
		color: 'gray.900',
	},
	splitContainer: {
		flex: '1',
		minH: '0',
		gap: '4',
		align: 'stretch',
	},
	listPane: {
		flex: { base: 'none', xl: '0 0 42%' },
		maxW: { xl: '42%' },
		minW: '0',
		minH: '0',
		display: 'flex',
		flexDirection: 'column',
		overflow: 'hidden',
	},
	invoicePane: {
		flex: '1',
		minW: '0',
		minH: { base: '70vh', xl: '0' },
		overflow: 'hidden',
	},
	listScrollArea: {
		flex: '1',
		minH: '0',
		overflowY: 'auto',
	},
} satisfies StylesObject

const SellingInvoicesPage = () => {
	const { t } = useTranslation()
	const { user } = useUser()
	const { canSee } = useSee()
	const canSeeBuying = canSee(SEE.sellingInvoicesBuyingButton)
	const canSeeSellingList = canSee(SEE.sellingInvoices)
	const canSeeAddSelling = canSee(SEE.sellingInvoicesSellingButton)
	const canSeeAddBuying = canSee(SEE.invoicesBuyingAdd)
	const canSeeEntries = canSee(SEE.sellingInvoicesEntriesButton)
	const canSeeAddEntries = canSee(SEE.invoicesEntriesAdd)
	const canEditSelling = canSee(SEE.sellingInvoicesEdit)
	const canEditBuying = canSee(SEE.invoicesBuyingEdit)
	const canEditEntries = canSee(SEE.invoicesEntriesEdit)
	const canSeeSummary = canSee(SEE.sellingInvoicesSummary)
	const canSeeInvoiceLists = canSeeBuying || canSeeSellingList || canSeeEntries
	const breadCrumbItems = generateBreadcrumbs()
	const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null)
	const [detailMode, setDetailMode] =
		useState<Extract<InvoicePanelMode, 'view' | 'edit'>>('view')
	const [invoicePendingDelete, setInvoicePendingDelete] = useState<
		string | null
	>(null)
	const [invoicePendingDeleteKind, setInvoicePendingDeleteKind] = useState<
		'selling' | 'buying'
	>('selling')
	const [draftTabPendingClose, setDraftTabPendingClose] = useState<
		string | null
	>(null)
	const [buyingDraftTabPendingClose, setBuyingDraftTabPendingClose] = useState<
		string | null
	>(null)

	const {
		isOpen: isDetailOpen,
		onOpen: onDetailOpen,
		onClose: onDetailClose,
	} = useDisclosure()
	const {
		isOpen: isBuyingDetailOpen,
		onOpen: onBuyingDetailOpen,
		onClose: onBuyingDetailClose,
	} = useDisclosure()
	const {
		isOpen: isDeleteOpen,
		onOpen: onDeleteOpen,
		onClose: onDeleteClose,
	} = useDisclosure()
	const {
		isOpen: isCloseDraftOpen,
		onOpen: onCloseDraftOpen,
		onClose: onCloseDraftClose,
	} = useDisclosure()
	const {
		isOpen: isCloseBuyingDraftOpen,
		onOpen: onCloseBuyingDraftOpen,
		onClose: onCloseBuyingDraftClose,
	} = useDisclosure()
	const {
		isOpen: isEntryOpen,
		onOpen: onEntryOpen,
		onClose: onEntryClose,
	} = useDisclosure()
	const [entryModalMode, setEntryModalMode] =
		useState<QuickEntryModalMode>('create')
	const [selectedEntry, setSelectedEntry] = useState<DailyAction | null>(null)

	const [summaryDateFrom, setSummaryDateFrom] = useState(() => new Date())
	const [summaryDateTo, setSummaryDateTo] = useState(() => new Date())

	const summaryQueryParams = useMemo(
		() => ({
			dateFrom: dayjs(summaryDateFrom).format('YYYY-MM-DD'),
			dateTo: dayjs(summaryDateTo).format('YYYY-MM-DD'),
		}),
		[summaryDateFrom, summaryDateTo],
	)

	const { data: invoicesMeta, isLoading: isSummaryLoading } =
		useGetSellingInvoicesQuery(summaryQueryParams, {
			skip: !canSeeSummary && !canSeeAddSelling,
			refetchOnMountOrArgChange: false,
		})
	const { data: buyingInvoicesMeta } = useGetBuyingInvoicesQuery(
		{},
		{ skip: !canSeeBuying, refetchOnMountOrArgChange: false },
	)

	const cashBalancePeriodQuery = useMemo(
		() => ({
			entryType: ['RECEIPT_ENTRY', 'PAYMENT_ENTRY', 'EXPENSE_ENTRY'],
			invoiceDateFrom: dayjs(summaryDateFrom).format('YYYY-MM-DD'),
			invoiceDateTo: dayjs(summaryDateTo).format('YYYY-MM-DD'),
		}),
		[summaryDateFrom, summaryDateTo],
	)

	const cashBalanceAllTimeQuery = useMemo(
		() => ({
			entryType: ['RECEIPT_ENTRY', 'PAYMENT_ENTRY', 'EXPENSE_ENTRY'],
			invoiceDateFrom: CASH_BALANCE_ALL_TIME_FROM,
		}),
		[],
	)

	const {
		data: periodDailyActions = [],
		isLoading: isPeriodCashBalanceLoading,
	} = useGetDailyActionsQuery(cashBalancePeriodQuery, {
		skip: !canSeeSummary,
		refetchOnMountOrArgChange: false,
	})
	const {
		data: allTimeDailyActions = [],
		isLoading: isAllTimeCashBalanceLoading,
	} = useGetDailyActionsQuery(cashBalanceAllTimeQuery, {
		skip: !canSeeSummary,
		refetchOnMountOrArgChange: false,
	})

	const { options: cashBalanceCurrencyOptions } = useInvoiceDisplayCurrency()
	const { data: invoiceCustomers = [] } = useGetCustomersQuery(undefined, {
		skip:
			!canSeeSellingList &&
			!canSeeAddSelling &&
			!canSeeEntries &&
			!canSeeAddEntries,
		refetchOnMountOrArgChange: false,
	})
	const { data: invoiceSuppliers = [] } = useGetSuppliersQuery(
		{},
		{ skip: !canSeeBuying, refetchOnMountOrArgChange: false },
	)

	const [deleteSellingInvoice, { isLoading: isDeletingInvoice }] =
		useDeleteSellingInvoiceMutation()
	const [deleteBuyingInvoice, { isLoading: isDeletingBuyingInvoice }] =
		useDeleteBuyingInvoiceMutation()

	const salesPerson =
		[user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
		user?.email ||
		'User'

	const {
		sessions,
		activeSessionId,
		activeSession,
		setActiveSessionId,
		createSession,
		updateDraft,
		setShowNote,
		clearInitialProductSearch,
		removeSession,
	} = useInvoiceDraftSessions({
		nextInvoiceNumber: invoicesMeta?.nextInvoiceNumber ?? 1,
		salesPerson,
		walkInCustomerName: t('components.sellingInvoices.drawer.walkInCustomer'),
	})

	const isCreatingInvoice = sessions.length > 0

	const {
		sessions: buyingSessions,
		activeSessionId: activeBuyingSessionId,
		activeSession: activeBuyingSession,
		setActiveSessionId: setActiveBuyingSessionId,
		createSession: createBuyingSession,
		updateDraft: updateBuyingDraft,
		setShowNote: setBuyingShowNote,
		clearInitialProductSearch: clearBuyingInitialProductSearch,
		removeSession: removeBuyingSession,
	} = useBuyingInvoiceDraftSessions({
		nextInvoiceNumber: buyingInvoicesMeta?.nextInvoiceNumber ?? 1,
		salesPerson,
	})

	const isCreatingBuyingInvoice =
		(canSeeBuying || canSeeAddBuying) && buyingSessions.length > 0

	useEffect(() => {
		if (!activeSession?.initialProductSearch) return
		clearInitialProductSearch(activeSession.id)
	}, [
		activeSession?.id,
		activeSession?.initialProductSearch,
		clearInitialProductSearch,
	])

	useEffect(() => {
		if (!activeBuyingSession?.initialProductSearch) return
		clearBuyingInitialProductSearch(activeBuyingSession.id)
	}, [
		activeBuyingSession?.id,
		activeBuyingSession?.initialProductSearch,
		clearBuyingInitialProductSearch,
	])

	const handleDraftChange = useCallback(
		(
			updater:
				| SellingInvoiceDraft
				| ((current: SellingInvoiceDraft) => SellingInvoiceDraft),
		) => {
			if (!activeSessionId) return
			updateDraft(activeSessionId, updater)
		},
		[activeSessionId, updateDraft],
	)

	const handleShowNoteChange = useCallback(
		(showNote: boolean) => {
			if (!activeSessionId) return
			setShowNote(activeSessionId, showNote)
		},
		[activeSessionId, setShowNote],
	)

	const handleBuyingDraftChange = useCallback(
		(
			updater:
				| BuyingInvoiceDraft
				| ((current: BuyingInvoiceDraft) => BuyingInvoiceDraft),
		) => {
			if (!activeBuyingSessionId) return
			updateBuyingDraft(activeBuyingSessionId, updater)
		},
		[activeBuyingSessionId, updateBuyingDraft],
	)

	const handleBuyingShowNoteChange = useCallback(
		(showNote: boolean) => {
			if (!activeBuyingSessionId) return
			setBuyingShowNote(activeBuyingSessionId, showNote)
		},
		[activeBuyingSessionId, setBuyingShowNote],
	)

	const handleSummaryDateFromChange = useCallback((date: Date | undefined) => {
		if (!date) return
		setSummaryDateFrom(date)
	}, [])

	const handleSummaryDateToChange = useCallback((date: Date | undefined) => {
		if (!date) return
		setSummaryDateTo(date)
	}, [])

	const summary = useMemo(
		() =>
			invoicesMeta?.summary
				? mapApiSummaryToUi(invoicesMeta.summary)
				: {
						todaySales: 0,
						todaySalesTrend: 0,
						paidInvoices: 0,
						paidInvoicesTrend: 0,
						creditInvoices: 0,
						creditInvoicesTrend: 0,
						totalReceivable: 0,
						averageOrder: 0,
						totalProfit: 0,
						bestSeller: null,
						topProfitProduct: null,
						salesSparkline: [],
					},
		[invoicesMeta?.summary],
	)

	const sellingInvoicesForCashBalance = useMemo(
		() => (invoicesMeta?.invoices ?? []) as ApiSellingInvoice[],
		[invoicesMeta?.invoices],
	)

	const buyingInvoicesForCashBalance = useMemo(
		() => (buyingInvoicesMeta?.invoices ?? []) as ApiBuyingInvoice[],
		[buyingInvoicesMeta?.invoices],
	)

	const periodCashBalanceRange = useMemo(
		() => ({
			dateFrom: dayjs(summaryDateFrom).format('YYYY-MM-DD'),
			dateTo: dayjs(summaryDateTo).format('YYYY-MM-DD'),
		}),
		[summaryDateFrom, summaryDateTo],
	)

	const allTimeCashBalanceRange = useMemo(
		() => ({ dateFrom: CASH_BALANCE_ALL_TIME_FROM }),
		[],
	)

	const periodCashBalance = useMemo(
		() =>
			calculateCashBalance({
				dailyActions: periodDailyActions,
				sellingInvoices: sellingInvoicesForCashBalance,
				buyingInvoices: buyingInvoicesForCashBalance,
				range: periodCashBalanceRange,
				displayCurrencyOptions: cashBalanceCurrencyOptions,
			}),
		[
			periodDailyActions,
			sellingInvoicesForCashBalance,
			buyingInvoicesForCashBalance,
			periodCashBalanceRange,
			cashBalanceCurrencyOptions,
		],
	)

	const allTimeCashBalance = useMemo(
		() =>
			calculateCashBalance({
				dailyActions: allTimeDailyActions,
				sellingInvoices: sellingInvoicesForCashBalance,
				buyingInvoices: buyingInvoicesForCashBalance,
				range: allTimeCashBalanceRange,
				displayCurrencyOptions: cashBalanceCurrencyOptions,
			}),
		[
			allTimeDailyActions,
			sellingInvoicesForCashBalance,
			buyingInvoicesForCashBalance,
			allTimeCashBalanceRange,
			cashBalanceCurrencyOptions,
		],
	)

	const draftTabs = useMemo(
		() =>
			sessions.map((session, index) => ({
				id: session.id,
				label: t('components.sellingInvoices.drawer.draftTab', {
					index: index + 1,
				}),
			})),
		[sessions, t],
	)

	const buyingDraftTabs = useMemo(
		() =>
			buyingSessions.map((session, index) => ({
				id: session.id,
				label: t('components.buyingInvoices.drawer.draftTab', {
					index: index + 1,
				}),
			})),
		[buyingSessions, t],
	)

	const openNewInvoicePanel = (options?: {
		productSearch?: string
		paymentType?: SellingInvoicePaymentType
	}) => {
		createSession(options)
	}

	const handleNewInvoice = () => {
		openNewInvoicePanel()
	}

	const handleNewBuyingInvoice = () => {
		createBuyingSession()
	}

	const handleNewCreditInvoice = () => {
		openNewInvoicePanel({ paymentType: InvoicePaymentType.CREDIT })
	}

	const handleBarcodeSearchSubmit = (value: string) => {
		if (!canSeeAddSelling) return

		const barcode = normalizeBarcode(value)
		if (!barcode) return

		openNewInvoicePanel({ productSearch: barcode })
	}

	const requestCloseDraftTab = (sessionId: string) => {
		const session = sessions.find(item => item.id === sessionId)
		if (!session) return

		if (isDraftSessionDirty(session)) {
			setDraftTabPendingClose(sessionId)
			onCloseDraftOpen()
			return
		}

		removeSession(sessionId)
	}

	const handleConfirmCloseDraftTab = () => {
		if (draftTabPendingClose) {
			removeSession(draftTabPendingClose)
		}
		setDraftTabPendingClose(null)
		onCloseDraftClose()
	}

	const handleCreateInvoiceSaved = () => {
		if (activeSessionId) {
			removeSession(activeSessionId)
		}
	}

	const requestCloseBuyingDraftTab = (sessionId: string) => {
		const session = buyingSessions.find(item => item.id === sessionId)
		if (!session) return

		if (isBuyingInvoiceDraftSessionDirty(session)) {
			setBuyingDraftTabPendingClose(sessionId)
			onCloseBuyingDraftOpen()
			return
		}

		removeBuyingSession(sessionId)
	}

	const handleConfirmCloseBuyingDraftTab = () => {
		if (buyingDraftTabPendingClose) {
			removeBuyingSession(buyingDraftTabPendingClose)
		}
		setBuyingDraftTabPendingClose(null)
		onCloseBuyingDraftClose()
	}

	const handleCreateBuyingInvoiceSaved = () => {
		if (activeBuyingSessionId) {
			removeBuyingSession(activeBuyingSessionId)
		}
	}

	const handleDetailInvoiceSaved = () => {
		handleDetailClose()
		handleBuyingDetailClose()
	}

	const openInvoiceDetail = (
		invoiceId: string,
		kind: 'selling' | 'buying',
		mode: Extract<InvoicePanelMode, 'view' | 'edit'>,
	) => {
		setDetailInvoiceId(invoiceId)
		setDetailMode(mode)

		if (kind === 'buying') {
			onBuyingDetailOpen()
			return
		}

		onDetailOpen()
	}

	const handleDetailClose = () => {
		onDetailClose()
		setDetailInvoiceId(null)
		setDetailMode('view')
	}

	const handleBuyingDetailClose = () => {
		onBuyingDetailClose()
		setDetailInvoiceId(null)
		setDetailMode('view')
	}

	const handleViewInvoice = (invoiceId: string, kind: 'selling' | 'buying') => {
		openInvoiceDetail(invoiceId, kind, 'view')
	}

	const handleEditInvoice = (invoiceId: string, kind: 'selling' | 'buying') => {
		if (kind === 'buying' && !canEditBuying) return
		if (kind === 'selling' && !canEditSelling) return
		openInvoiceDetail(invoiceId, kind, 'edit')
	}

	const handleDeleteInvoiceRequest = (
		invoiceId: string,
		kind: 'selling' | 'buying',
	) => {
		setInvoicePendingDelete(invoiceId)
		setInvoicePendingDeleteKind(kind)
		onDeleteOpen()
	}

	const handleConfirmDeleteInvoice = async () => {
		if (!invoicePendingDelete) return

		try {
			if (invoicePendingDeleteKind === 'buying') {
				await deleteBuyingInvoice(invoicePendingDelete).unwrap()
			} else {
				await deleteSellingInvoice(invoicePendingDelete).unwrap()
			}

			if (detailInvoiceId === invoicePendingDelete) {
				handleDetailClose()
				handleBuyingDetailClose()
			}
		} finally {
			setInvoicePendingDelete(null)
			setInvoicePendingDeleteKind('selling')
			onDeleteClose()
		}
	}

	const handleNewEntry = () => {
		setSelectedEntry(null)
		setEntryModalMode('create')
		onEntryOpen()
	}

	const handleViewEntry = (entry: DailyAction) => {
		setSelectedEntry(entry)
		setEntryModalMode('view')
		onEntryOpen()
	}

	const handleEditEntry = (entry: DailyAction) => {
		if (!canEditEntries) return
		setSelectedEntry(entry)
		setEntryModalMode('edit')
		onEntryOpen()
	}

	const handleEntryModalClose = () => {
		onEntryClose()
		setSelectedEntry(null)
		setEntryModalMode('create')
	}

	const invoiceListSection = (
		<InvoiceTableSection
			showBuyingInvoices={canSeeBuying}
			showSellingInvoices={canSeeSellingList}
			showEntries={canSeeEntries}
			onViewInvoice={handleViewInvoice}
			onEditInvoice={handleEditInvoice}
			onDeleteInvoice={handleDeleteInvoiceRequest}
			onViewEntry={handleViewEntry}
			onEditEntry={handleEditEntry}
		/>
	)

	const newInvoiceButton = (
		<HStack spacing={0}>
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
					aria-label={t('components.sellingInvoices.newInvoiceOptions')}
				>
					<ChevronDownIcon />
				</MenuButton>
				<MenuList>
					<MenuItem onClick={handleNewInvoice}>
						{t('components.sellingInvoices.newInvoice')}
					</MenuItem>
					<MenuItem onClick={handleNewCreditInvoice}>
						{t('components.sellingInvoices.newCreditInvoice')}
					</MenuItem>
				</MenuList>
			</Menu>
			<Button
				leftIcon={
					<Icon
						as={AsInvoiceIcon}
						color={PAGE_COLORS.border}
						boxSize={6}
						fill="#1D4ED8"
					/>
				}
				bg={PAGE_COLORS.primary}
				color="white"
				borderTopLeftRadius="lg"
				borderBottomLeftRadius="lg"
				borderTopRightRadius={0}
				borderBottomRightRadius={0}
				fontWeight={600}
				px={5}
				_hover={{ bg: '#1D4ED8' }}
				onClick={handleNewInvoice}
			>
				{t('components.sellingInvoices.newInvoice')}
			</Button>
		</HStack>
	)

	const adminActionButtons = (
		<>
			{canSeeAddBuying && (
				<Button
					leftIcon={<Icon as={AsTruckIcon} boxSize={5} />}
					variant="outline"
					borderRadius="lg"
					borderColor={PAGE_COLORS.border}
					fontWeight={600}
					onClick={handleNewBuyingInvoice}
				>
					{t('components.sellingInvoices.newBuyingInvoice')}
				</Button>
			)}
			{canSeeAddEntries && (
				<Button
					leftIcon={<Icon as={AsCashBalanceIcon} boxSize={5} />}
					variant="outline"
					borderRadius="lg"
					borderColor={PAGE_COLORS.border}
					fontWeight={600}
					onClick={handleNewEntry}
				>
					{t('components.sellingInvoices.newEntry')}
				</Button>
			)}
		</>
	)

	const invoiceDetailOverlays = (
		<>
			<InvoiceDetailModal
				isOpen={isDetailOpen}
				invoiceId={detailInvoiceId}
				mode={detailMode}
				customers={invoiceCustomers}
				onClose={handleDetailClose}
				onSaved={handleDetailInvoiceSaved}
				onRequestEdit={canEditSelling ? () => setDetailMode('edit') : undefined}
			/>
			<BuyingInvoiceDetailModal
				isOpen={isBuyingDetailOpen}
				buyingInvoiceId={detailInvoiceId}
				mode={detailMode}
				suppliers={invoiceSuppliers}
				onClose={handleBuyingDetailClose}
				onSaved={handleDetailInvoiceSaved}
				onRequestEdit={canEditBuying ? () => setDetailMode('edit') : undefined}
			/>
			<ConfirmationDialog
				isOpen={isDeleteOpen}
				onClose={() => {
					setInvoicePendingDelete(null)
					setInvoicePendingDeleteKind('selling')
					onDeleteClose()
				}}
				onConfirm={handleConfirmDeleteInvoice}
				header={t('components.sellingInvoices.actions.deleteConfirmTitle')}
				headerIcon={AsTrashIcon}
				body={t('components.sellingInvoices.actions.deleteConfirmBody')}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={
					isDeletingInvoice || isDeletingBuyingInvoice
				}
			/>
			<ConfirmationDialog
				isOpen={isCloseDraftOpen}
				onClose={() => {
					setDraftTabPendingClose(null)
					onCloseDraftClose()
				}}
				onConfirm={handleConfirmCloseDraftTab}
				header={t('components.sellingInvoices.drawer.closeDraftTitle')}
				body={t('components.sellingInvoices.drawer.closeDraftBody')}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t(
					'components.sellingInvoices.drawer.discardDraft',
				)}
			/>
			<ConfirmationDialog
				isOpen={isCloseBuyingDraftOpen}
				onClose={() => {
					setBuyingDraftTabPendingClose(null)
					onCloseBuyingDraftClose()
				}}
				onConfirm={handleConfirmCloseBuyingDraftTab}
				header={t('components.buyingInvoices.drawer.closeDraftTitle')}
				body={t('components.buyingInvoices.drawer.closeDraftBody')}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t(
					'components.buyingInvoices.drawer.discardDraft',
				)}
			/>
			{(canSeeEntries || canSeeAddEntries) && (
				<QuickEntryModal
					isOpen={isEntryOpen}
					onClose={handleEntryModalClose}
					mode={entryModalMode}
					initialEntry={selectedEntry}
					customers={invoiceCustomers}
					suppliers={invoiceSuppliers}
				/>
			)}
		</>
	)

	const showBuyingDraft = Boolean(
		isCreatingBuyingInvoice && activeBuyingSession,
	)
	const showSellingDraft = Boolean(isCreatingInvoice && activeSession)
	const isDraftOpen = showBuyingDraft || showSellingDraft

	// Keep InvoiceTableSection mounted across draft open/close so list queries
	// and local table filters are not remount-refetched / reset.
	return (
		<>
			<Flex sx={styles.wrapper}>
				<Flex
					sx={isDraftOpen ? styles.splitContainer : undefined}
					direction={isDraftOpen ? { base: 'column', xl: 'row' } : undefined}
					flex={isDraftOpen ? undefined : 1}
					minH={0}
				>
					<Box
						sx={isDraftOpen ? styles.listPane : { width: '100%', minW: 0 }}
						order={isDraftOpen ? { base: 2, xl: 1 } : undefined}
					>
						<CustomBreadcrumb
							marginTop="0.5rem"
							items={breadCrumbItems[BreadCrumbItem.INVOICES]}
						/>

						<Flex
							justify="space-between"
							align={{ base: 'stretch', sm: 'center' }}
							direction={{ base: 'column', sm: 'row' }}
							gap={isDraftOpen ? 3 : 4}
							mb={isDraftOpen ? 4 : 6}
							flexShrink={0}
						>
							<Heading
								sx={styles.title}
								variant="h5"
								fontSize={isDraftOpen ? 'xl' : undefined}
							>
								{t('components.sellingInvoices.title')}
							</Heading>
							{!isDraftOpen && (
								<HStack spacing={3} flexWrap="wrap">
									{adminActionButtons}
									{canSeeAddSelling ? newInvoiceButton : null}
								</HStack>
							)}
						</Flex>

						{canSeeSummary && !isDraftOpen ? (
							<Accordion allowToggle>
								<AccordionItem border="none">
									<AccordionButton px={0}>
										<Box flex="1" textAlign="right">
											{t('components.sellingInvoices.summaryTitle')}
										</Box>
										<AccordionIcon />
									</AccordionButton>
									<AccordionPanel px={0} pb={4}>
										<InvoiceSummaryCards
											summary={summary}
											isLoading={isSummaryLoading}
											dateFrom={summaryDateFrom}
											dateTo={summaryDateTo}
											onDateFromChange={handleSummaryDateFromChange}
											onDateToChange={handleSummaryDateToChange}
											showCashBalance={canSeeSummary}
											cashBalance={{
												period: periodCashBalance,
												allTime: allTimeCashBalance,
											}}
											isCashBalanceLoading={
												isPeriodCashBalanceLoading ||
												isAllTimeCashBalanceLoading
											}
										/>
									</AccordionPanel>
								</AccordionItem>
							</Accordion>
						) : null}

						{canSeeAddSelling && (
							<Box mb={isDraftOpen ? 4 : undefined} flexShrink={0}>
								<InvoiceBarcodeSearchBar onSubmit={handleBarcodeSearchSubmit} />
							</Box>
						)}

						{canSeeInvoiceLists ? (
							<Box sx={isDraftOpen ? styles.listScrollArea : undefined}>
								{invoiceListSection}
							</Box>
						) : null}
					</Box>

					{showBuyingDraft && activeBuyingSession ? (
						<Box sx={styles.invoicePane} order={{ base: 1, xl: 2 }}>
							<NewBuyingInvoicePanel
								key={activeBuyingSession.id}
								isActive
								salesPerson={salesPerson}
								suppliers={invoiceSuppliers}
								onClose={() =>
									requestCloseBuyingDraftTab(activeBuyingSession.id)
								}
								onSaved={handleCreateBuyingInvoiceSaved}
								nextInvoiceNumber={buyingInvoicesMeta?.nextInvoiceNumber ?? 1}
								initialProductSearch={
									activeBuyingSession.initialProductSearch ?? ''
								}
								draft={activeBuyingSession.draft}
								onDraftChange={handleBuyingDraftChange}
								showNote={activeBuyingSession.showNote}
								onShowNoteChange={handleBuyingShowNoteChange}
								draftTabs={buyingDraftTabs}
								activeDraftTabId={activeBuyingSessionId ?? undefined}
								onSelectDraftTab={setActiveBuyingSessionId}
								onCloseDraftTab={requestCloseBuyingDraftTab}
								onAddDraftTab={() => createBuyingSession()}
							/>
						</Box>
					) : showSellingDraft && activeSession ? (
						<Box sx={styles.invoicePane} order={{ base: 1, xl: 2 }}>
							<NewSellingInvoicePanel
								key={activeSession.id}
								isActive
								customers={invoiceCustomers}
								onClose={() => requestCloseDraftTab(activeSession.id)}
								onSaved={handleCreateInvoiceSaved}
								nextInvoiceNumber={invoicesMeta?.nextInvoiceNumber ?? 1}
								initialProductSearch={activeSession.initialProductSearch ?? ''}
								draft={activeSession.draft}
								onDraftChange={handleDraftChange}
								showNote={activeSession.showNote}
								onShowNoteChange={handleShowNoteChange}
								draftTabs={draftTabs}
								activeDraftTabId={activeSessionId ?? undefined}
								onSelectDraftTab={setActiveSessionId}
								onCloseDraftTab={requestCloseDraftTab}
								onAddDraftTab={() => createSession()}
							/>
						</Box>
					) : null}
				</Flex>
			</Flex>
			{invoiceDetailOverlays}
		</>
	)
}

export default SellingInvoicesPage
