import {
	Badge,
	Box,
	Button,
	Flex,
	HStack,
	Icon,
	IconButton,
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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useGetBuyingInvoicesQuery } from '../../api/apiStore'
import { useSee } from '../../shared/hooks/useSee'
import { SEE } from '../../shared/seeFlags'
import { AsWatcherEyeIcon } from '../../shared/icons/WatcherEye'
import BuyingInvoiceDetailModal from '../BuyingInvoice/BuyingInvoiceDetailModal'
import type { BuyingInvoicePanelMode } from '../BuyingInvoice/NewBuyingInvoicePanel'
import {
	mapApiBuyingInvoiceToTableRow,
	type ApiBuyingInvoice,
} from '../BuyingInvoice/buyingInvoiceApiMappers'
import CurrencyAmountTooltip from '../SellingInvoice/CurrencyAmountTooltip'
import {
	INVOICES_PER_PAGE,
	PAGE_COLORS,
	PAYMENT_TYPE_CONFIG,
	PaymentTypeIcon,
	STATUS_CONFIG,
} from '../SellingInvoice/constants'
import { formatInvoiceAmountForDisplay } from '../SellingInvoice/currencyDisplay'
import { InvoicePaymentType, InvoiceUiStatus } from '../../shared/globalEnums'
import type {
	SellingInvoice,
	SellingInvoiceStatus,
} from '../SellingInvoice/types'
import { useInvoiceDisplayCurrency } from '../SellingInvoice/useInvoiceDisplayCurrency'

const SUPPLIER_STATUS_FILTER_TABS = [
	'all',
	InvoiceUiStatus.PAID,
	InvoiceUiStatus.CREDIT,
	InvoiceUiStatus.PARTIAL,
] as const

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

interface SupplierInvoicesTabProps {
	supplierId: string
}

const SupplierInvoicesTab = ({ supplierId }: SupplierInvoicesTabProps) => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const canEditBuying = canSee(SEE.invoicesBuyingEdit)
	const [statusFilter, setStatusFilter] = useState('all')
	const [currentPage, setCurrentPage] = useState(1)
	const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null)
	const [detailMode, setDetailMode] =
		useState<Extract<BuyingInvoicePanelMode, 'view' | 'edit'>>('view')
	const {
		isOpen: isDetailOpen,
		onOpen: onDetailOpen,
		onClose: onDetailClose,
	} = useDisclosure()

	const queryParams = {
		supplierId,
		status: statusFilter === 'all' ? undefined : statusFilter,
	}

	const {
		data: invoicesResponse,
		isLoading,
		isFetching,
	} = useGetBuyingInvoicesQuery(queryParams, {
		skip: !supplierId,
	})

	const { options: displayCurrencyOptions, displayCurrencyId } =
		useInvoiceDisplayCurrency()

	const invoices = useMemo((): SellingInvoice[] => {
		return (invoicesResponse?.invoices ?? []).map(invoice =>
			mapApiBuyingInvoiceToTableRow(invoice as ApiBuyingInvoice),
		)
	}, [invoicesResponse?.invoices])

	const totalCount = invoices.length
	const totalPages = Math.max(1, Math.ceil(totalCount / INVOICES_PER_PAGE))
	const paginatedInvoices = useMemo(() => {
		const start = (currentPage - 1) * INVOICES_PER_PAGE
		return invoices.slice(start, start + INVOICES_PER_PAGE)
	}, [invoices, currentPage])

	const startIndex =
		totalCount === 0 ? 0 : (currentPage - 1) * INVOICES_PER_PAGE + 1
	const endIndex = Math.min(currentPage * INVOICES_PER_PAGE, totalCount)

	const handleStatusFilterChange = (status: string) => {
		setStatusFilter(status)
		setCurrentPage(1)
	}

	const handleViewInvoice = (invoiceId: string) => {
		setDetailInvoiceId(invoiceId)
		setDetailMode('view')
		onDetailOpen()
	}

	const handleDetailClose = () => {
		setDetailInvoiceId(null)
		setDetailMode('view')
		onDetailClose()
	}

	const showInitialLoader = isLoading && !invoicesResponse
	const showRefetchOverlay = isFetching && !showInitialLoader

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
								{t('components.supplier.invoices')}
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
					</Flex>

					<Flex gap={2} flexWrap="wrap">
						{SUPPLIER_STATUS_FILTER_TABS.map(tab => {
							const isActive = statusFilter === tab

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
									onClick={() => handleStatusFilterChange(tab)}
								>
									{t(`components.sellingInvoices.status.${tab}`)}
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
										<Th whiteSpace="nowrap">
											{t('components.sellingInvoices.columns.actions')}
										</Th>
									</Tr>
								</Thead>
								<Tbody>
									{paginatedInvoices.length === 0 ? (
										<Tr>
											<Td colSpan={8} py={10} textAlign="center">
												<Text color={PAGE_COLORS.muted}>
													{t('components.sellingInvoices.empty')}
												</Text>
											</Td>
										</Tr>
									) : (
										paginatedInvoices.map(invoice => {
											const paymentConfig =
												PAYMENT_TYPE_CONFIG[
													invoice.paymentType === InvoicePaymentType.CREDIT
														? InvoicePaymentType.CREDIT
														: InvoicePaymentType.CASH
												]

											return (
												<Tr
													key={invoice.id}
													_hover={{ bg: 'gray.50', cursor: 'pointer' }}
													onClick={() => handleViewInvoice(invoice.id)}
												>
													<Td fontWeight={600} color="gray.900">
														{invoice.invoiceNumber}
													</Td>
													<Td color={PAGE_COLORS.muted} whiteSpace="nowrap">
														{invoice.time}
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
															displayText={formatInvoiceAmountForDisplay(
																invoice.currencyAmounts,
																'amount',
																displayCurrencyId,
																invoice.total,
																displayCurrencyOptions,
															)}
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
													<Td>
														<IconButton
															size="xs"
															variant="ghost"
															aria-label={t(
																'components.sellingInvoices.actions.view',
															)}
															icon={
																<Icon
																	as={AsWatcherEyeIcon}
																	color={PAGE_COLORS.primary}
																	boxSize={5}
																/>
															}
															color={PAGE_COLORS.muted}
															onClick={event => {
																event.stopPropagation()
																handleViewInvoice(invoice.id)
															}}
														/>
													</Td>
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

			<BuyingInvoiceDetailModal
				isOpen={isDetailOpen}
				buyingInvoiceId={detailInvoiceId}
				mode={detailMode}
				onClose={handleDetailClose}
				onRequestEdit={canEditBuying ? () => setDetailMode('edit') : undefined}
			/>
		</Box>
	)
}

export default SupplierInvoicesTab
