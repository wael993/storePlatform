import {
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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	useDeleteSellingInvoiceMutation,
	useGetSellingInvoicesQuery,
} from '../../api/apiStore'
import CustomBreadcrumb from '../CustomBreadcrumb'
import ConfirmationDialog from '../ConfirmationDialog'
import { BreadCrumbItem } from '../../shared/globalEnums'
import { generateBreadcrumbs } from '../../shared/routes'
import { pageContentMinHeight } from '../../theme/layout'
import { PAGE_COLORS } from './constants'
import { mapApiSummaryToUi } from './invoiceApiMappers'
import InvoiceBarcodeSearchBar from './InvoiceBarcodeSearchBar'
import InvoiceDetailModal from './InvoiceDetailModal'
import InvoiceSummaryCards from './InvoiceSummaryCards'
import InvoiceTableSection from './InvoiceTableSection'
import NewSellingInvoicePanel, {
	type InvoicePanelMode,
} from './NewSellingInvoicePanel'
import type { SellingInvoicePaymentType } from './types'
import { normalizeSearchQuery as normalizeBarcode } from './productSearch'
import { AsInvoiceIcon } from '../../icons/Invoice'
import { AsTrashIcon } from '../../icons/Trash'

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
	const breadCrumbItems = generateBreadcrumbs()

	const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)
	const [panelProductSearch, setPanelProductSearch] = useState('')
	const [panelPaymentType, setPanelPaymentType] =
		useState<SellingInvoicePaymentType>('cash')
	const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null)
	const [detailMode, setDetailMode] =
		useState<Extract<InvoicePanelMode, 'view' | 'edit'>>('view')
	const [invoicePendingDelete, setInvoicePendingDelete] = useState<
		string | null
	>(null)

	const {
		isOpen: isDetailOpen,
		onOpen: onDetailOpen,
		onClose: onDetailClose,
	} = useDisclosure()
	const {
		isOpen: isDeleteOpen,
		onOpen: onDeleteOpen,
		onClose: onDeleteClose,
	} = useDisclosure()

	// Stable query for summary / next invoice number — not tied to table search
	const { data: invoicesMeta, isLoading: isSummaryLoading } =
		useGetSellingInvoicesQuery({
			issuedDate: dayjs().format('YYYY-MM-DD'),
		})

	const [deleteSellingInvoice, { isLoading: isDeletingInvoice }] =
		useDeleteSellingInvoiceMutation()

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
						salesSparkline: [],
					},
		[invoicesMeta?.summary],
	)

	const openNewInvoicePanel = (options?: {
		productSearch?: string
		paymentType?: SellingInvoicePaymentType
	}) => {
		setPanelProductSearch(options?.productSearch ?? '')
		setPanelPaymentType(options?.paymentType ?? 'cash')
		setIsCreatingInvoice(true)
	}

	const handleNewInvoice = () => {
		openNewInvoicePanel()
	}

	const handleNewCreditInvoice = () => {
		openNewInvoicePanel({ paymentType: 'credit' })
	}

	const handleBarcodeSearchSubmit = (value: string) => {
		const barcode = normalizeBarcode(value)
		if (!barcode) return

		openNewInvoicePanel({ productSearch: barcode })
	}

	const handleInvoiceSaved = () => {
		setIsCreatingInvoice(false)
		handleDetailClose()
	}

	const openInvoiceDetail = (
		invoiceId: string,
		mode: Extract<InvoicePanelMode, 'view' | 'edit'>,
	) => {
		setDetailInvoiceId(invoiceId)
		setDetailMode(mode)
		onDetailOpen()
	}

	const handleDetailClose = () => {
		onDetailClose()
		setDetailInvoiceId(null)
		setDetailMode('view')
	}

	const handleViewInvoice = (invoiceId: string) => {
		openInvoiceDetail(invoiceId, 'view')
	}

	const handleEditInvoice = (invoiceId: string) => {
		openInvoiceDetail(invoiceId, 'edit')
	}

	const handleDeleteInvoiceRequest = (invoiceId: string) => {
		setInvoicePendingDelete(invoiceId)
		onDeleteOpen()
	}

	const handleConfirmDeleteInvoice = async () => {
		if (!invoicePendingDelete) return

		try {
			await deleteSellingInvoice(invoicePendingDelete).unwrap()
			if (detailInvoiceId === invoicePendingDelete) {
				handleDetailClose()
			}
		} finally {
			setInvoicePendingDelete(null)
			onDeleteClose()
		}
	}

	const invoiceListSection = (
		<InvoiceTableSection
			onViewInvoice={handleViewInvoice}
			onEditInvoice={handleEditInvoice}
			onDeleteInvoice={handleDeleteInvoiceRequest}
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
					isDisabled={isCreatingInvoice}
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
				isDisabled={isCreatingInvoice}
			>
				{t('components.sellingInvoices.newInvoice')}
			</Button>
		</HStack>
	)

	const invoiceDetailOverlays = (
		<>
			<InvoiceDetailModal
				isOpen={isDetailOpen}
				invoiceId={detailInvoiceId}
				mode={detailMode}
				onClose={handleDetailClose}
				onSaved={handleInvoiceSaved}
				onRequestEdit={() => setDetailMode('edit')}
			/>
			<ConfirmationDialog
				isOpen={isDeleteOpen}
				onClose={() => {
					setInvoicePendingDelete(null)
					onDeleteClose()
				}}
				onConfirm={handleConfirmDeleteInvoice}
				header={t('components.sellingInvoices.actions.deleteConfirmTitle')}
				headerIcon={AsTrashIcon}
				body={t('components.sellingInvoices.actions.deleteConfirmBody')}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeletingInvoice}
			/>
		</>
	)

	if (isCreatingInvoice) {
		return (
			<>
				<Flex sx={styles.wrapper}>
					<Flex
						sx={styles.splitContainer}
						direction={{ base: 'column', xl: 'row' }}
					>
						<Box sx={styles.listPane} order={{ base: 2, xl: 1 }}>
							<CustomBreadcrumb
								marginTop="0.5rem"
								items={breadCrumbItems[BreadCrumbItem.INVOICES]}
							/>

							<Flex
								justify="space-between"
								align={{ base: 'stretch', sm: 'center' }}
								direction={{ base: 'column', sm: 'row' }}
								gap={3}
								mb={4}
								flexShrink={0}
							>
								<Heading sx={styles.title} variant="h5" fontSize="xl">
									{t('components.sellingInvoices.title')}
								</Heading>
							</Flex>

							<Box mb={4} flexShrink={0}>
								<InvoiceBarcodeSearchBar
									onSubmit={handleBarcodeSearchSubmit}
								/>
							</Box>

							<Box sx={styles.listScrollArea}>{invoiceListSection}</Box>
						</Box>

						<Box sx={styles.invoicePane} order={{ base: 1, xl: 2 }}>
							<NewSellingInvoicePanel
								isActive={isCreatingInvoice}
								onClose={() => setIsCreatingInvoice(false)}
								onSaved={handleInvoiceSaved}
								nextInvoiceNumber={invoicesMeta?.nextInvoiceNumber ?? 1}
								initialProductSearch={panelProductSearch}
								initialPaymentType={panelPaymentType}
							/>
						</Box>
					</Flex>
				</Flex>
				{invoiceDetailOverlays}
			</>
		)
	}

	return (
		<>
			<Flex sx={styles.wrapper}>
				<CustomBreadcrumb
					marginTop="0.5rem"
					items={breadCrumbItems[BreadCrumbItem.INVOICES]}
				/>

				<Flex
					justify="space-between"
					align={{ base: 'stretch', sm: 'center' }}
					direction={{ base: 'column', sm: 'row' }}
					gap={4}
					mb={6}
				>
					<Heading sx={styles.title} variant="h5">
						{t('components.sellingInvoices.title')}
					</Heading>
					{newInvoiceButton}
				</Flex>

				<InvoiceSummaryCards summary={summary} isLoading={isSummaryLoading} />

				<InvoiceBarcodeSearchBar onSubmit={handleBarcodeSearchSubmit} />

				<Box>{invoiceListSection}</Box>
			</Flex>
			{invoiceDetailOverlays}
		</>
	)
}

export default SellingInvoicesPage
