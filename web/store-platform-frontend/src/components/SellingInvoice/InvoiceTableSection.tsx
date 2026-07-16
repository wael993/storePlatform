import {
	Badge,
	Box,
	Button,
	Flex,
	HStack,
	Icon,
	IconButton,
	Input,
	InputGroup,
	InputLeftElement,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	Spinner,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from '@chakra-ui/react'
import { ChevronDownIcon } from '@chakra-ui/icons'
import dayjs from 'dayjs'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useGetSellingInvoicesQuery } from '../../api/apiStore'
import { SortIcon } from '../icons/Sort'
import {
	INVOICES_PER_PAGE,
	PAGE_COLORS,
	PAYMENT_TYPE_CONFIG,
	STATUS_CONFIG,
	STATUS_FILTER_TABS,
} from './constants'
import {
	mapApiInvoiceToSellingInvoice,
	type ApiSellingInvoice,
} from './invoiceApiMappers'
import { normalizeSearchQuery } from './productSearch'
import type {
	SellingInvoicePaymentType,
	SellingInvoiceSortKey,
	SellingInvoiceStatus,
	SortDirection,
} from './types'
import { sortInvoices } from './utils'
import { useInvoiceDisplayCurrency } from './useInvoiceDisplayCurrency'
import { AsSearchIcon } from '../../icons/Search'
import { AsWatcherEyeIcon } from '../../shared/icons/WatcherEye'
import { AsThreeDotsIcon } from '../../shared/icons/ThreeDots'
import { AsPriceTagIcon } from '../../shared/icons/PriceTag'
import { AsEditIcon } from '../../shared/icons/Edit'
import { AsCashIcon } from '../../icons/Cash'
import { AsCreditCardIcon } from '../../icons/CreditCard'
import { AsTrashIcon } from '../../icons/Trash'
import DatePickerLabel from '../common/DatePickerLabel'
import { datePickerStyles } from '../../theme/styles'
import CurrencyAmountTooltip from './CurrencyAmountTooltip'
import { formatInvoiceAmountForDisplay } from './currencyDisplay'

interface InvoiceTableSectionProps {
	onViewInvoice: (invoiceId: string) => void
	onEditInvoice: (invoiceId: string) => void
	onDeleteInvoice: (invoiceId: string) => void
}

const PaymentTypeIcon = ({ type }: { type: SellingInvoicePaymentType }) => {
	switch (type) {
		case 'cash':
			return <Icon as={AsCashIcon} color={PAGE_COLORS.success} boxSize={5} />
		case 'credit':
			return (
				<Icon
					as={AsPriceTagIcon}
					fill="none"
					color={PAGE_COLORS.danger}
					boxSize={5}
				/>
			)
		case 'card':
			return (
				<Icon as={AsCreditCardIcon} color={PAGE_COLORS.warning} boxSize={5} />
			)
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

const InvoiceTableSection = ({
	onViewInvoice,
	onEditInvoice,
	onDeleteInvoice,
}: InvoiceTableSectionProps) => {
	const { t } = useTranslation()
	const searchInputRef = useRef<HTMLInputElement>(null)

	const [tableSearch, setTableSearch] = useState('')
	const [statusFilter, setStatusFilter] = useState('all')
	const [currentPage, setCurrentPage] = useState(1)
	const [sortKey, setSortKey] = useState<SellingInvoiceSortKey>('invoiceNumber')
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
	const [selectedDate, setSelectedDate] = useState(new Date())

	const activeSearch = tableSearch.trim() || undefined

	const { data: invoicesResponse, isLoading, isFetching } =
		useGetSellingInvoicesQuery({
			searchText: activeSearch,
			status: statusFilter === 'all' ? undefined : statusFilter,
			issuedDate: activeSearch
				? undefined
				: dayjs(selectedDate).format('YYYY-MM-DD'),
		})

	const {
		options: displayCurrencyOptions,
		displayCurrencyId,
	} = useInvoiceDisplayCurrency()

	const invoices = useMemo(
		() =>
			(invoicesResponse?.invoices ?? []).map(invoice =>
				mapApiInvoiceToSellingInvoice(invoice as ApiSellingInvoice),
			),
		[invoicesResponse?.invoices],
	)

	const sortedInvoices = useMemo(
		() => sortInvoices(invoices, sortKey, sortDirection),
		[invoices, sortKey, sortDirection],
	)

	const totalCount = invoicesResponse?.totalCount ?? invoices.length

	const paginatedInvoices = useMemo(() => {
		const start = (currentPage - 1) * INVOICES_PER_PAGE
		return sortedInvoices.slice(start, start + INVOICES_PER_PAGE)
	}, [sortedInvoices, currentPage])

	const totalPages = Math.max(1, Math.ceil(totalCount / INVOICES_PER_PAGE))
	const startIndex =
		totalCount === 0 ? 0 : (currentPage - 1) * INVOICES_PER_PAGE + 1
	const endIndex = Math.min(currentPage * INVOICES_PER_PAGE, totalCount)

	const pageNumbers = useMemo(() => {
		const pages: number[] = []
		const maxVisible = 5
		let start = Math.max(1, currentPage - 2)
		const end = Math.min(totalPages, start + maxVisible - 1)

		if (end - start < maxVisible - 1) {
			start = Math.max(1, end - maxVisible + 1)
		}

		for (let page = start; page <= end; page += 1) {
			pages.push(page)
		}

		return pages
	}, [currentPage, totalPages])

	const handleSearchKeyDown = (
		event: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (event.key !== 'Enter') return

		event.preventDefault()
		setTableSearch(normalizeSearchQuery(searchInputRef.current?.value ?? ''))
		setCurrentPage(1)
	}

	const handleStatusFilterChange = (status: string) => {
		setStatusFilter(status)
		setCurrentPage(1)
	}

	const handleDateChange = (date: Date | undefined) => {
		setSelectedDate(date || new Date())
		setCurrentPage(1)
	}

	const handleSortChange = (key: SellingInvoiceSortKey) => {
		if (sortKey === key) {
			setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
			return
		}

		setSortKey(key)
		setSortDirection('desc')
	}

	const showInitialLoader = isLoading && !invoicesResponse
	const showRefetchOverlay = isFetching && !showInitialLoader

	return (
		<Box
			bg="white"
			borderRadius="xl"
			border="1px solid"
			borderColor={PAGE_COLORS.border}
			boxShadow={PAGE_COLORS.cardShadow}
			overflow="hidden"
			minHeight={'25rem'}
			position="relative"
		>
			<Box
				p={{ base: 4, md: 5 }}
				borderBottom="1px solid"
				borderColor={PAGE_COLORS.border}
			>
				<Flex
					direction={{ base: 'column', lg: 'row' }}
					gap={4}
					justify="space-between"
					align={{ base: 'stretch', lg: 'center' }}
					mb={4}
				>
					<HStack spacing={2}>
						<Text fontSize="lg" fontWeight={700} color="gray.900">
							{t('components.sellingInvoices.todaysInvoices')}
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

					<Flex
						gap={2}
						align="center"
						justify={{ base: 'stretch', lg: 'flex-end' }}
					>
						<InputGroup maxW={{ base: '100%', md: '16rem' }} size="sm">
							<InputLeftElement pointerEvents="none">
								<Icon
									as={AsSearchIcon}
									color={PAGE_COLORS.primary}
									boxSize={5}
								/>
							</InputLeftElement>
							<Input
								ref={searchInputRef}
								defaultValue={tableSearch}
								onKeyDown={handleSearchKeyDown}
								placeholder={t('components.sellingInvoices.searchPlaceholder')}
								borderRadius="lg"
								bg="gray.50"
								border="1px solid"
								borderColor={PAGE_COLORS.border}
								pl={10}
								autoComplete="off"
								spellCheck={false}
							/>
						</InputGroup>
						<DatePickerLabel
							label={''}
							onChange={handleDateChange}
							defaultDate={selectedDate}
							styles={{
								...datePickerStyles,
								dateInput: {
									...datePickerStyles.dateInput,
									color: PAGE_COLORS.muted,
									backgroundColor: PAGE_COLORS.cardShadow,
								},
							}}
						/>
					</Flex>
				</Flex>

				<Flex gap={2} flexWrap="wrap">
					{STATUS_FILTER_TABS.map(tab => {
						const isActive = statusFilter === tab

						return (
							<Button
								key={tab}
								size="sm"
								borderRadius="full"
								fontWeight={600}
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
									<Th
										cursor="pointer"
										onClick={() => handleSortChange('invoiceNumber')}
										whiteSpace="nowrap"
									>
										<HStack spacing={1}>
											<Text>#</Text>
											<SortIcon
												boxSize={3}
												color={
													sortKey === 'invoiceNumber'
														? PAGE_COLORS.primary
														: PAGE_COLORS.muted
												}
												transform={
													sortKey === 'invoiceNumber' &&
													sortDirection === 'desc'
														? 'rotate(180deg)'
														: undefined
												}
											/>
										</HStack>
									</Th>
									<Th
										cursor="pointer"
										onClick={() => handleSortChange('time')}
										whiteSpace="nowrap"
									>
										<HStack spacing={1}>
											<Text>
												{t('components.sellingInvoices.columns.time')}
											</Text>
											<SortIcon
												boxSize={3}
												color={
													sortKey === 'time'
														? PAGE_COLORS.primary
														: PAGE_COLORS.muted
												}
												transform={
													sortKey === 'time' && sortDirection === 'desc'
														? 'rotate(180deg)'
														: undefined
												}
											/>
										</HStack>
									</Th>
									<Th whiteSpace="nowrap">
										{t('components.sellingInvoices.columns.customer')}
									</Th>
									<Th whiteSpace="nowrap">
										{t('components.sellingInvoices.columns.status')}
									</Th>
									<Th whiteSpace="nowrap">
										{t('components.sellingInvoices.columns.paymentType')}
									</Th>
									<Th isNumeric whiteSpace="nowrap">
										{t('components.sellingInvoices.columns.items')}
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
										<Td colSpan={10} py={10} textAlign="center">
											<Text color={PAGE_COLORS.muted}>
												{t('components.sellingInvoices.empty')}
											</Text>
										</Td>
									</Tr>
								) : (
									paginatedInvoices.map(invoice => {
										const paymentConfig =
											PAYMENT_TYPE_CONFIG[invoice.paymentType]

										return (
											<Tr
												key={invoice.id}
												_hover={{ bg: 'gray.50' }}
												borderBottom="1px solid"
												borderColor={PAGE_COLORS.border}
											>
												<Td fontWeight={600} color="gray.900">
													{invoice.invoiceNumber}
												</Td>
												<Td color={PAGE_COLORS.muted} whiteSpace="nowrap">
													{invoice.time}
												</Td>
												<Td color="gray.800" whiteSpace="nowrap">
													{invoice.customerName}
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
												<Td isNumeric color="gray.800">
													{invoice.itemCount}
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
													<HStack spacing={1}>
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
															onClick={() => onViewInvoice(invoice.id)}
														/>
														<IconButton
															size="xs"
															variant="ghost"
															aria-label={t(
																'components.sellingInvoices.actions.edit',
															)}
															icon={
																<Icon
																	as={AsEditIcon}
																	color={PAGE_COLORS.primary}
																	boxSize={5}
																/>
															}
															color={PAGE_COLORS.muted}
															onClick={() => onEditInvoice(invoice.id)}
														/>
														<IconButton
															size="xs"
															variant="ghost"
															aria-label={t(
																'components.sellingInvoices.actions.delete',
															)}
															icon={
																<Icon
																	as={AsTrashIcon}
																	fill="none"
																	color={PAGE_COLORS.danger}
																	boxSize={5}
																/>
															}
															color={PAGE_COLORS.muted}
															onClick={() => onDeleteInvoice(invoice.id)}
														/>
														<Menu>
															<MenuButton
																as={IconButton}
																size="xs"
																variant="ghost"
																aria-label={t(
																	'components.sellingInvoices.actions.more',
																)}
																icon={
																	<Icon
																		as={AsThreeDotsIcon}
																		color={PAGE_COLORS.primary}
																		boxSize={5}
																	/>
																}
																color={PAGE_COLORS.muted}
															/>
															<MenuList>
																<MenuItem
																	onClick={() => onViewInvoice(invoice.id)}
																>
																	{t(
																		'components.sellingInvoices.actions.view',
																	)}
																</MenuItem>
																<MenuItem
																	onClick={() => onEditInvoice(invoice.id)}
																>
																	{t(
																		'components.sellingInvoices.actions.edit',
																	)}
																</MenuItem>
																<MenuItem
																	onClick={() => onDeleteInvoice(invoice.id)}
																	color={PAGE_COLORS.danger}
																>
																	{t(
																		'components.sellingInvoices.actions.delete',
																	)}
																</MenuItem>
															</MenuList>
														</Menu>
													</HStack>
												</Td>
											</Tr>
										)
									})
								)}
							</Tbody>
						</Table>
					</Box>

					<Flex
						p={4}
						direction={{ base: 'column', sm: 'row' }}
						justify="space-between"
						align={{ base: 'stretch', sm: 'center' }}
						gap={3}
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

						<HStack spacing={1} justify={{ base: 'center', sm: 'flex-end' }}>
							<IconButton
								size="sm"
								variant="outline"
								aria-label={t('pagination.previous')}
								icon={<ChevronDownIcon transform="rotate(-90deg)" />}
								isDisabled={currentPage <= 1}
								onClick={() => setCurrentPage(currentPage - 1)}
								borderRadius="md"
								borderColor={PAGE_COLORS.border}
							/>
							{pageNumbers.map(page => (
								<Button
									key={page}
									size="sm"
									minW="2rem"
									borderRadius="md"
									variant={page === currentPage ? 'solid' : 'outline'}
									bg={page === currentPage ? PAGE_COLORS.primary : 'white'}
									color={
										page === currentPage ? 'white' : PAGE_COLORS.muted
									}
									borderColor={
										page === currentPage
											? PAGE_COLORS.primary
											: PAGE_COLORS.border
									}
									onClick={() => setCurrentPage(page)}
								>
									{page}
								</Button>
							))}
							<IconButton
								size="sm"
								variant="outline"
								aria-label={t('pagination.next')}
								icon={<ChevronDownIcon transform="rotate(90deg)" />}
								isDisabled={currentPage >= totalPages}
								onClick={() => setCurrentPage(currentPage + 1)}
								borderRadius="md"
								borderColor={PAGE_COLORS.border}
							/>
						</HStack>
					</Flex>
				</>
			)}
		</Box>
	)
}

export default InvoiceTableSection
