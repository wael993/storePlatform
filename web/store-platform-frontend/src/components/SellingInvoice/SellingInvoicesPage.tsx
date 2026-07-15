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
	Spinner,
} from '@chakra-ui/react'
import { ChevronDownIcon } from '@chakra-ui/icons'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useGetSellingInvoicesQuery } from '../../api/apiStore'
import CustomBreadcrumb from '../CustomBreadcrumb'
import { BreadCrumbItem } from '../../shared/globalEnums'
import { generateBreadcrumbs } from '../../shared/routes'
import { pageContentMinHeight } from '../../theme/layout'
import { INVOICES_PER_PAGE, PAGE_COLORS } from './constants'
import {
	mapApiInvoiceToSellingInvoice,
	mapApiSummaryToUi,
	type ApiSellingInvoice,
} from './invoiceApiMappers'
import InvoiceBarcodeSearchBar from './InvoiceBarcodeSearchBar'
import InvoiceSummaryCards from './InvoiceSummaryCards'
import InvoiceTableSection from './InvoiceTableSection'
import NewSellingInvoicePanel from './NewSellingInvoicePanel'
import type {
	SellingInvoicePaymentType,
	SellingInvoiceSortKey,
	SortDirection,
} from './types'
import { sortInvoices } from './utils'
import { normalizeSearchQuery as normalizeBarcode } from './productSearch'
import { AsInvoiceIcon } from '../../icons/Invoice'

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

	const [tableSearch, setTableSearch] = useState('')
	const [statusFilter, setStatusFilter] = useState('all')
	const [currentPage, setCurrentPage] = useState(1)
	const [sortKey, setSortKey] = useState<SellingInvoiceSortKey>('invoiceNumber')
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
	const [selectedDate, setSelectedDate] = useState(new Date())
	const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)
	const [panelProductSearch, setPanelProductSearch] = useState('')
	const [panelPaymentType, setPanelPaymentType] =
		useState<SellingInvoicePaymentType>('cash')

	const {
		data: invoicesResponse,
		isLoading,
		isFetching,
		refetch,
	} = useGetSellingInvoicesQuery({
		searchText: tableSearch.trim() || undefined,
		status: statusFilter === 'all' ? undefined : statusFilter,
		issuedDate: dayjs(selectedDate).format('YYYY-MM-DD'),
	})

	const invoices = useMemo(
		() =>
			(invoicesResponse?.invoices ?? []).map(invoice =>
				mapApiInvoiceToSellingInvoice(invoice as ApiSellingInvoice),
			),
		[invoicesResponse?.invoices],
	)

	const summary = useMemo(
		() =>
			invoicesResponse?.summary
				? mapApiSummaryToUi(invoicesResponse.summary)
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
		[invoicesResponse?.summary],
	)

	const sortedInvoices = useMemo(
		() => sortInvoices(invoices, sortKey, sortDirection),
		[invoices, sortKey, sortDirection],
	)

	const paginatedInvoices = useMemo(() => {
		const start = (currentPage - 1) * INVOICES_PER_PAGE
		return sortedInvoices.slice(start, start + INVOICES_PER_PAGE)
	}, [sortedInvoices, currentPage])

	const handleSortChange = (key: SellingInvoiceSortKey) => {
		if (sortKey === key) {
			setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
			return
		}

		setSortKey(key)
		setSortDirection('desc')
	}

	const handleStatusFilterChange = (status: string) => {
		setStatusFilter(status)
		setCurrentPage(1)
	}

	const handleDateChange = (date: Date | undefined) => {
		setSelectedDate(date || new Date())
		setCurrentPage(1)
	}

	const handleTableSearchChange = (value: string) => {
		setTableSearch(value)
		setCurrentPage(1)
	}

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
		refetch()
	}

	const isLoadingInvoices = isLoading || isFetching

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

	const invoiceListSection = isLoadingInvoices ? (
		<Flex justify="center" py={10}>
			<Spinner color={PAGE_COLORS.primary} />
		</Flex>
	) : (
		<InvoiceTableSection
			invoices={paginatedInvoices}
			totalCount={invoicesResponse?.totalCount ?? invoices.length}
			currentPage={currentPage}
			searchText={tableSearch}
			statusFilter={statusFilter}
			selectedDate={selectedDate}
			sortKey={sortKey}
			sortDirection={sortDirection}
			onSearchChange={handleTableSearchChange}
			onStatusFilterChange={handleStatusFilterChange}
			onDateChange={handleDateChange}
			onPageChange={setCurrentPage}
			onSortChange={handleSortChange}
		/>
	)

	if (isCreatingInvoice) {
		return (
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
							nextInvoiceNumber={invoicesResponse?.nextInvoiceNumber ?? 1}
							initialProductSearch={panelProductSearch}
							initialPaymentType={panelPaymentType}
						/>
					</Box>
				</Flex>
			</Flex>
		)
	}

	return (
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

			<InvoiceSummaryCards summary={summary} isLoading={isLoadingInvoices} />

			<InvoiceBarcodeSearchBar onSubmit={handleBarcodeSearchSubmit} />

			<Box>{invoiceListSection}</Box>
		</Flex>
	)
}

export default SellingInvoicesPage
