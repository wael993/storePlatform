import { Box, Flex, Skeleton, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { PAGE_COLORS } from './constants'
import type { SellingInvoiceSummary } from './types'
import { formatTrend } from './utils'
import { useInvoiceDisplayCurrency } from './useInvoiceDisplayCurrency'
// import { AsTimeIcon } from '../../shared/icons/Time'
import { AsPriceActivityFeeIcon } from '../../shared/icons/price/PriceActivityFeeIcon'
import { DollarSignIcon } from '../../icons/DollarSign'
import { WalletIcon } from '../../icons/Wallet'
import { AsPriceTagIcon } from '../../shared/icons/PriceTag'
import { AsCashBalanceIcon } from '../../icons/CashBalance'
import DatePickerLabel from '../common/DatePickerLabel'
import { datePickerStyles } from '../../theme/styles'

export interface CashBalanceSummaryValues {
	period: number
	allTime: number
}

interface InvoiceSummaryCardsProps {
	summary: SellingInvoiceSummary
	isLoading?: boolean
	dateFrom: Date
	dateTo: Date
	onDateFromChange: (date: Date | undefined) => void
	onDateToChange: (date: Date | undefined) => void
	showCashBalance?: boolean
	cashBalance?: CashBalanceSummaryValues
	isCashBalanceLoading?: boolean
}

const cardStyles = {
	base: {
		bg: 'white',
		borderRadius: 'xl',
		border: '1px solid',
		borderColor: PAGE_COLORS.border,
		p: '5',
		flex: '1',
		minW: { base: '100%', sm: 'calc(50% - 0.5rem)', lg: '0' },
		boxShadow: PAGE_COLORS.cardShadow,
	},
	label: {
		fontSize: 'sm',
		fontWeight: '500',
		color: PAGE_COLORS.muted,
		mb: '1',
	},
	value: {
		fontSize: { base: 'xl', md: '2xl' },
		fontWeight: '700',
		color: 'gray.900',
		lineHeight: '1.2',
	},
	productValue: {
		fontSize: { base: 'md', md: 'lg' },
		fontWeight: '700',
		color: 'gray.900',
		lineHeight: '1.3',
		noOfLines: 2,
	},
	subValue: {
		fontSize: { base: 'lg', md: 'xl' },
		fontWeight: '700',
		color: 'gray.900',
		lineHeight: '1.2',
	},
	subLabel: {
		fontSize: 'xs',
		fontWeight: '500',
		color: PAGE_COLORS.muted,
		mb: '0.5',
		mt: '2',
	},
	trend: {
		fontSize: 'xs',
		fontWeight: '600',
		mt: '1',
	},
	iconCircle: {
		w: '2.5rem',
		h: '2.5rem',
		borderRadius: 'full',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: '0',
	},
} satisfies StylesObject

const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
	const width = 80
	const height = 32
	const max = Math.max(...data)
	const min = Math.min(...data)
	const range = max - min || 1

	const points = data
		.map((value, index) => {
			const x = (index / (data.length - 1)) * width
			const y = height - ((value - min) / range) * (height - 4) - 2
			return `${x},${y}`
		})
		.join(' ')

	return (
		<svg width={width} height={height} aria-hidden="true">
			<polyline
				fill="none"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				points={points}
			/>
		</svg>
	)
}
interface SummaryCardProps {
	label: string
	value: string
	valueSx?: StylesObject[keyof StylesObject]
	trend?: string
	trendColor?: string
	icon?: React.ReactNode
	iconBg?: string
	iconColor?: string
	sparkline?: { data: number[]; color: string }
}

const SummaryCard = ({
	label,
	value,
	valueSx,
	trend,
	trendColor,
	icon,
	iconBg,
	iconColor,
	sparkline,
}: SummaryCardProps) => (
	<Box sx={cardStyles.base}>
		<Flex justify="space-between" align="flex-start">
			<Box flex="1" minW={0}>
				<Text sx={cardStyles.label}>{label}</Text>
				<Text sx={valueSx ?? cardStyles.value}>{value}</Text>
				{trend && (
					<Text
						sx={{
							...cardStyles.trend,
							color: trendColor ?? PAGE_COLORS.success,
						}}
					>
						{trend}
					</Text>
				)}
				{sparkline && (
					<Box mt={2}>
						<Sparkline data={sparkline.data} color={sparkline.color} />
					</Box>
				)}
			</Box>
			{icon && (
				<Flex
					sx={{
						...cardStyles.iconCircle,
						bg: iconBg,
						color: iconColor,
					}}
				>
					{icon}
				</Flex>
			)}
		</Flex>
	</Box>
)

const EMPTY_SUMMARY_VALUE = '—'

interface CashBalanceSummaryCardProps {
	title: string
	periodLabel: string
	allTimeLabel: string
	periodValue: string
	allTimeValue: string
	isLoading?: boolean
}

const CashBalanceSummaryCard = ({
	title,
	periodLabel,
	allTimeLabel,
	periodValue,
	allTimeValue,
	isLoading = false,
}: CashBalanceSummaryCardProps) => (
	<Box sx={cardStyles.base}>
		<Flex justify="space-between" align="flex-start">
			<Box flex="1" minW={0}>
				<Text sx={cardStyles.label}>{title}</Text>
				<Text sx={cardStyles.subLabel}>{periodLabel}</Text>
				{isLoading ? (
					<Skeleton height="1.5rem" width="70%" mt={1} />
				) : (
					<Text sx={cardStyles.subValue}>{periodValue}</Text>
				)}
				<Text sx={cardStyles.subLabel}>{allTimeLabel}</Text>
				{isLoading ? (
					<Skeleton height="1.5rem" width="70%" mt={1} />
				) : (
					<Text sx={cardStyles.subValue}>{allTimeValue}</Text>
				)}
			</Box>
			<Flex
				sx={{
					...cardStyles.iconCircle,
					bg: '#E0F2FE',
					color: '#0369A1',
				}}
			>
				<AsCashBalanceIcon boxSize={5} />
			</Flex>
		</Flex>
	</Box>
)

const InvoiceSummaryCards = ({
	summary,
	isLoading = false,
	dateFrom,
	dateTo,
	onDateFromChange,
	onDateToChange,
	showCashBalance = false,
	cashBalance,
	isCashBalanceLoading = false,
}: InvoiceSummaryCardsProps) => {
	const { t } = useTranslation()
	const { formatAmount } = useInvoiceDisplayCurrency()

	const bestSellerValue = summary.bestSeller
		? t('components.sellingInvoices.summary.bestSellerValue', {
				name: summary.bestSeller.productName,
				quantity: summary.bestSeller.quantity,
			})
		: EMPTY_SUMMARY_VALUE

	const topProfitValue = summary.topProfitProduct
		? t('components.sellingInvoices.summary.topProfitProductValue', {
				name: summary.topProfitProduct.productName,
				profit: formatAmount(summary.topProfitProduct.profit),
			})
		: EMPTY_SUMMARY_VALUE

	const hasPeriodData =
		summary.bestSeller !== null ||
		summary.topProfitProduct !== null ||
		summary.todaySales > 0

	if (isLoading) {
		const skeletonCount = showCashBalance ? 9 : 8

		return (
			<Box mb={6}>
				<Flex gap={3} flexWrap="wrap" mb={4}>
					<Skeleton height="2.5rem" width="12rem" borderRadius="lg" />
					<Skeleton height="2.5rem" width="12rem" borderRadius="lg" />
				</Flex>
				<Flex gap={4} flexWrap="wrap">
					{Array.from({ length: skeletonCount }).map((_, index) => (
						<Skeleton
							key={index}
							height="7rem"
							flex="1"
							minW={{ base: '100%', sm: 'calc(50% - 0.5rem)', lg: '0' }}
							borderRadius="xl"
						/>
					))}
				</Flex>
			</Box>
		)
	}

	return (
		<Box mb={6}>
			<Flex gap={3} flexWrap="wrap" mb={4}>
				<Box maxW={{ base: '100%', sm: '12rem' }}>
					<DatePickerLabel
						label={t('common.from')}
						onChange={onDateFromChange}
						defaultDate={dateFrom}
						maxDate={dateTo}
						styles={datePickerStyles}
					/>
				</Box>
				<Box maxW={{ base: '100%', sm: '12rem' }}>
					<DatePickerLabel
						label={t('common.to')}
						onChange={onDateToChange}
						defaultDate={dateTo}
						minDate={dateFrom}
						styles={datePickerStyles}
					/>
				</Box>
			</Flex>

			<Flex gap={4} flexWrap="wrap" direction={{ base: 'column', sm: 'row' }}>
				<SummaryCard
					label={t('components.sellingInvoices.summary.periodSales')}
					value={
						hasPeriodData
							? formatAmount(summary.todaySales)
							: EMPTY_SUMMARY_VALUE
					}
					trend={formatTrend(summary.todaySalesTrend)}
					trendColor={PAGE_COLORS.success}
					sparkline={{
						data: summary.salesSparkline,
						color: PAGE_COLORS.success,
					}}
				/>
				<SummaryCard
					label={t('components.sellingInvoices.summary.totalProfit')}
					value={
						hasPeriodData
							? formatAmount(summary.totalProfit)
							: EMPTY_SUMMARY_VALUE
					}
					icon={<DollarSignIcon fill="none" />}
					iconBg="#ECFDF5"
					iconColor="#047857"
				/>
				<SummaryCard
					label={t('components.sellingInvoices.summary.bestSeller')}
					value={bestSellerValue}
					valueSx={cardStyles.productValue}
					icon={<AsPriceTagIcon fill="none" />}
					iconBg="#FEF3C7"
					iconColor="#B45309"
				/>
				<SummaryCard
					label={t('components.sellingInvoices.summary.topProfitProduct')}
					value={topProfitValue}
					valueSx={cardStyles.productValue}
					icon={<AsPriceActivityFeeIcon />}
					iconBg="#EDE9FE"
					iconColor="#6D28D9"
				/>
				{/* <SummaryCard
					label={t('components.sellingInvoices.summary.paidInvoices')}
					value={String(summary.paidInvoices)}
					trend={formatTrend(summary.paidInvoicesTrend, '')}
					trendColor={PAGE_COLORS.success}
					icon={<DollarSignIcon fill="none" />}
					iconBg="#DCFCE7"
					iconColor="#15803D"
				/> */}
				{/* <SummaryCard
					label={t('components.sellingInvoices.summary.creditInvoices')}
					value={String(summary.creditInvoices)}
					trend={formatTrend(summary.creditInvoicesTrend, '')}
					trendColor={PAGE_COLORS.warning}
					icon={<AsPriceActivityFeeIcon />}
					iconBg="#FFEDD5"
					iconColor="#C2410C"
				/> */}
				<SummaryCard
					label={t('components.sellingInvoices.summary.totalReceivable')}
					value={formatAmount(summary.totalReceivable)}
					icon={<WalletIcon fill="none" />}
					iconBg="#FEE2E2"
					iconColor="#DC2626"
				/>
				{/* <SummaryCard
					label={t('components.sellingInvoices.summary.averageOrder')}
					value={
						hasPeriodData
							? formatAmount(summary.averageOrder)
							: EMPTY_SUMMARY_VALUE
					}
					icon={<AsTimeIcon />}
					iconBg="#DBEAFE"
					iconColor="#2563EB"
				/> */}
				{showCashBalance && cashBalance && (
					<CashBalanceSummaryCard
						title={t('components.sellingInvoices.summary.cashBalance')}
						periodLabel={t(
							'components.sellingInvoices.summary.cashBalancePeriod',
						)}
						allTimeLabel={t(
							'components.sellingInvoices.summary.cashBalanceAllTime',
						)}
						periodValue={formatAmount(cashBalance.period)}
						allTimeValue={formatAmount(cashBalance.allTime)}
						isLoading={isCashBalanceLoading}
					/>
				)}
			</Flex>
		</Box>
	)
}

export default InvoiceSummaryCards
