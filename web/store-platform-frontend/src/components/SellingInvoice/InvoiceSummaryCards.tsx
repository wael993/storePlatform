import { Box, Flex, Skeleton, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { FiCreditCard } from 'react-icons/fi'
import { PAGE_COLORS } from './constants'
import type { SellingInvoiceSummary } from './types'
import { formatTrend } from './utils'
import { useInvoiceDisplayCurrency } from './useInvoiceDisplayCurrency'
import {
	useGetCashAccountBalancesQuery,
	useGetCurrencySettingsQuery,
} from '../../api/apiStore'
import { getWorkMode } from '../../offline/workMode'
import { formatNumber } from '../../shared/utils'
import { useOfflineSync } from '../../shared/hooks/useOfflineSync'
import { useUser } from '../../shared/hooks/useUser'
// import { AsTimeIcon } from '../../shared/icons/Time'
import { AsPriceActivityFeeIcon } from '../../shared/icons/price/PriceActivityFeeIcon'
import { DollarSignIcon } from '../../icons/DollarSign'
import { WalletIcon } from '../../icons/Wallet'
import { AsPriceTagIcon } from '../../shared/icons/PriceTag'
import { AsCashBalanceIcon } from '../../icons/CashBalance'
import DatePickerLabel from '../common/DatePickerLabel'
import { datePickerStyles } from '../../theme/styles'

interface InvoiceSummaryCardsProps {
	summary: SellingInvoiceSummary
	isLoading?: boolean
	dateFrom: Date
	dateTo: Date
	onDateFromChange: (date: Date | undefined) => void
	onDateToChange: (date: Date | undefined) => void
	/** Live Daily Cash + Online from ledger (same API as Dashboard). */
	showLedgerCash?: boolean
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

const InvoiceSummaryCards = ({
	summary,
	isLoading = false,
	dateFrom,
	dateTo,
	onDateFromChange,
	onDateToChange,
	showLedgerCash = false,
}: InvoiceSummaryCardsProps) => {
	const { t } = useTranslation()
	const { formatAmount } = useInvoiceDisplayCurrency()
	const { user } = useUser()
	const { isOnline } = useOfflineSync(user?.tenantId)
	const cashOpsOnline = isOnline && getWorkMode() !== 'offline'
	const {
		data: cashBalances,
		isLoading: isCashLoading,
		isFetching: isCashFetching,
		isError: isCashError,
	} = useGetCashAccountBalancesQuery(undefined, {
		skip: !showLedgerCash || !cashOpsOnline,
		refetchOnMountOrArgChange: false,
	})
	const { data: currencySettings } = useGetCurrencySettingsQuery(undefined, {
		skip: !showLedgerCash || !cashOpsOnline,
		refetchOnMountOrArgChange: false,
	})

	const currencyLabel =
		currencySettings?.primaryCurrency?.internalCode ||
		currencySettings?.primaryCurrency?.name ||
		''

	const formatLedgerBalance = (amount: number | undefined) => {
		if (!cashOpsOnline) return t('common.onlineOnly')
		if (isCashError) return t('dashboard.kpi.error')
		if (amount == null) return EMPTY_SUMMARY_VALUE
		const formatted = formatNumber(amount) ?? String(amount)
		return currencyLabel ? `${formatted} ${currencyLabel}` : formatted
	}

	const balanceByType = new Map(
		(cashBalances?.accounts ?? []).map(account => [account.type, account.balance]),
	)
	const showCashLoading =
		showLedgerCash &&
		cashOpsOnline &&
		(isCashLoading || (isCashFetching && !cashBalances))

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
	const showProfit = summary.profitReliable === true

	if (isLoading) {
		const skeletonCount = (showLedgerCash ? 10 : 8) - (showProfit ? 0 : 2)

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
						usePortal
					/>
				</Box>
				<Box maxW={{ base: '100%', sm: '12rem' }}>
					<DatePickerLabel
						label={t('common.to')}
						onChange={onDateToChange}
						defaultDate={dateTo}
						minDate={dateFrom}
						styles={datePickerStyles}
						usePortal
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
				{/* Hide profit until COGS is reliable (offline without local cost). */}
				{showProfit && (
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
				)}
				<SummaryCard
					label={t('components.sellingInvoices.summary.bestSeller')}
					value={bestSellerValue}
					valueSx={cardStyles.productValue}
					icon={<AsPriceTagIcon fill="none" />}
					iconBg="#FEF3C7"
					iconColor="#B45309"
				/>
				{showProfit && (
					<SummaryCard
						label={t('components.sellingInvoices.summary.topProfitProduct')}
						value={topProfitValue}
						valueSx={cardStyles.productValue}
						icon={<AsPriceActivityFeeIcon />}
						iconBg="#EDE9FE"
						iconColor="#6D28D9"
					/>
				)}
				<SummaryCard
					label={t('components.sellingInvoices.summary.totalReceivable')}
					value={formatAmount(summary.totalReceivable)}
					icon={<WalletIcon fill="none" />}
					iconBg="#FEE2E2"
					iconColor="#DC2626"
				/>
				{showLedgerCash && (
					<>
						<SummaryCard
							label={t('dashboard.cashAccounts.dailyCash')}
							value={
								showCashLoading
									? t('dashboard.kpi.loading')
									: formatLedgerBalance(balanceByType.get('daily_cash'))
							}
							icon={<AsCashBalanceIcon boxSize={5} />}
							iconBg="#ECFDF5"
							iconColor="#059669"
						/>
						<SummaryCard
							label={t('dashboard.cashAccounts.online')}
							value={
								showCashLoading
									? t('dashboard.kpi.loading')
									: formatLedgerBalance(balanceByType.get('online'))
							}
							icon={<FiCreditCard size={20} />}
							iconBg="#EFF6FF"
							iconColor="#2563EB"
						/>
					</>
				)}
			</Flex>
		</Box>
	)
}

export default InvoiceSummaryCards
