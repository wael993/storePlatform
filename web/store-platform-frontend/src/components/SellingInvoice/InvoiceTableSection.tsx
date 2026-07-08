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
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from '@chakra-ui/react'
import { ChevronDownIcon } from '@chakra-ui/icons'
// import dayjs from 'dayjs'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SortIcon } from '../icons/Sort'
import {
	INVOICES_PER_PAGE,
	PAGE_COLORS,
	PAYMENT_TYPE_CONFIG,
	STATUS_CONFIG,
	STATUS_FILTER_TABS,
} from './constants'
import type {
	SellingInvoice,
	SellingInvoicePaymentType,
	SellingInvoiceSortKey,
	SellingInvoiceStatus,
	SortDirection,
} from './types'
import { formatCurrency } from './utils'
import { AsSearchIcon } from '../../icons/Search'
// import { AsCalendarIcon } from '../../shared/icons/Calendar'
// import { AsFilterIcon } from '../../shared/icons/Filter'
// import { AsSettingsIcon } from '../../shared/icons/Settings'
import { AsWatcherEyeIcon } from '../../shared/icons/WatcherEye'
import { AsThreeDotsIcon } from '../../shared/icons/ThreeDots'
import { AsPriceTagIcon } from '../../shared/icons/PriceTag'
import { AsCashIcon } from '../../icons/Cash'
import { AsCreditCardIcon } from '../../icons/CreditCard'
import { AsPrintIcon } from '../../icons/Print'
import DatePickerLabel from '../common/DatePickerLabel'
import { datePickerStyles } from '../../theme/styles'

interface InvoiceTableSectionProps {
	invoices: SellingInvoice[]
	totalCount: number
	currentPage: number
	searchText: string
	statusFilter: string
	selectedDate: Date
	sortKey: SellingInvoiceSortKey
	sortDirection: SortDirection
	onSearchChange: (value: string) => void
	onStatusFilterChange: (status: string) => void
	onPageChange: (page: number) => void
	onSortChange: (key: SellingInvoiceSortKey) => void
	onDateChange: (date: Date | undefined) => void
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
	invoices,
	totalCount,
	currentPage,
	searchText,
	statusFilter,
	selectedDate,
	sortKey,
	sortDirection,
	onSearchChange,
	onStatusFilterChange,
	onPageChange,
	onSortChange,
	onDateChange,
}: InvoiceTableSectionProps) => {
	const { t } = useTranslation()

	const totalPages = Math.max(1, Math.ceil(totalCount / INVOICES_PER_PAGE))
	const startIndex =
		totalCount === 0 ? 0 : (currentPage - 1) * INVOICES_PER_PAGE + 1
	const endIndex = Math.min(currentPage * INVOICES_PER_PAGE, totalCount)

	// const formattedDate = useMemo(() => {
	// 	const isToday = dayjs(selectedDate).isSame(dayjs(), 'day')
	// 	const dateLabel = dayjs(selectedDate).format('D MMM YYYY')

	// 	return isToday
	// 		? t('components.sellingInvoices.todayDate', { date: dateLabel })
	// 		: dateLabel
	// }, [selectedDate, t])

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

	const handleSortClick = (key: SellingInvoiceSortKey) => {
		onSortChange(key)
	}

	return (
		<Box
			bg="white"
			borderRadius="xl"
			border="1px solid"
			borderColor={PAGE_COLORS.border}
			boxShadow={PAGE_COLORS.cardShadow}
			overflow="hidden"
			minHeight={'25rem'}
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
						// flexWrap="wrap"
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
								value={searchText}
								onChange={event => onSearchChange(event.target.value)}
								placeholder={t('components.sellingInvoices.searchPlaceholder')}
								borderRadius="lg"
								bg="gray.50"
								border="1px solid"
								borderColor={PAGE_COLORS.border}
							/>
						</InputGroup>
						<DatePickerLabel
							label={''}
							onChange={onDateChange}
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

						{/* <Button
							size="sm"
							variant="outline"
							leftIcon={ 
								<Icon
									as={AsFilterIcon}
									color={PAGE_COLORS.primary}
									boxSize={5}
								/>
							}
							borderRadius="lg"
							fontWeight={500}
							borderColor={PAGE_COLORS.border}
						>
							{t('components.sellingInvoices.filters')}
						</Button>

						<IconButton
							size="sm"
							variant="outline"
							aria-label={t('components.sellingInvoices.settings')}
							icon={
								<Icon
									as={AsSettingsIcon}
									color={PAGE_COLORS.primary}
									boxSize={5}
								/>
							}
							borderRadius="lg"
							borderColor={PAGE_COLORS.border}
						/> */}
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
								onClick={() => onStatusFilterChange(tab)}
							>
								{t(`components.sellingInvoices.status.${tab}`)}
							</Button>
						)
					})}
				</Flex>
			</Box>

			<Box overflowX="auto">
				<Table variant="simple" size="sm">
					<Thead bg="gray.50">
						<Tr>
							<Th
								cursor="pointer"
								onClick={() => handleSortClick('invoiceNumber')}
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
											sortKey === 'invoiceNumber' && sortDirection === 'desc'
												? 'rotate(180deg)'
												: undefined
										}
									/>
								</HStack>
							</Th>
							<Th
								cursor="pointer"
								onClick={() => handleSortClick('time')}
								whiteSpace="nowrap"
							>
								<HStack spacing={1}>
									<Text>{t('components.sellingInvoices.columns.time')}</Text>
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
						{invoices.length === 0 ? (
							<Tr>
								<Td colSpan={10} py={10} textAlign="center">
									<Text color={PAGE_COLORS.muted}>
										{t('components.sellingInvoices.empty')}
									</Text>
								</Td>
							</Tr>
						) : (
							invoices.map(invoice => {
								const paymentConfig = PAYMENT_TYPE_CONFIG[invoice.paymentType]

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
											{formatCurrency(invoice.total)}
										</Td>
										<Td isNumeric color="gray.800">
											{formatCurrency(invoice.paid)}
										</Td>
										<Td
											isNumeric
											fontWeight={invoice.due > 0 ? 600 : 400}
											color={invoice.due > 0 ? PAGE_COLORS.danger : 'gray.800'}
										>
											{formatCurrency(invoice.due)}
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
												/>
												<IconButton
													size="xs"
													variant="ghost"
													aria-label={t(
														'components.sellingInvoices.actions.print',
													)}
													icon={
														<Icon
															as={AsPrintIcon}
															color={PAGE_COLORS.primary}
															boxSize={5}
														/>
													}
													color={PAGE_COLORS.muted}
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
														<MenuItem>
															{t('components.sellingInvoices.actions.view')}
														</MenuItem>
														<MenuItem>
															{t('components.sellingInvoices.actions.print')}
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
						onClick={() => onPageChange(currentPage - 1)}
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
							color={page === currentPage ? 'white' : PAGE_COLORS.muted}
							borderColor={
								page === currentPage ? PAGE_COLORS.primary : PAGE_COLORS.border
							}
							onClick={() => onPageChange(page)}
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
						onClick={() => onPageChange(currentPage + 1)}
						borderRadius="md"
						borderColor={PAGE_COLORS.border}
					/>
				</HStack>
			</Flex>
		</Box>
	)
}

export default InvoiceTableSection
