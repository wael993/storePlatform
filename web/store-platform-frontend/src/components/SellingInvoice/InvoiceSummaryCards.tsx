import { Box, Flex, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FiCreditCard } from 'react-icons/fi'
import { PAGE_COLORS } from './constants'
import { useInvoiceDisplayCurrency } from './useInvoiceDisplayCurrency'
import { useGetCashAccountBalancesQuery } from '../../api/apiStore'
import { AsCashBalanceIcon } from '../../icons/CashBalance'

const cardStyles = {
	base: {
		bg: 'white',
		borderRadius: 'xl',
		border: '1px solid',
		borderColor: PAGE_COLORS.border,
		p: '5',
		flex: '1',
		minW: { base: '100%', sm: '16rem' },
		maxW: { base: '100%', sm: '22rem' },
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
	iconCircle: {
		w: '2.5rem',
		h: '2.5rem',
		borderRadius: 'full',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: '0',
	},
} satisfies StylesObject

const SummaryCard = ({
	label,
	value,
	icon,
	iconBg,
	iconColor,
}: {
	label: string
	value: string
	icon: ReactNode
	iconBg: string
	iconColor: string
}) => (
	<Box sx={cardStyles.base}>
		<Flex justify="space-between" align="flex-start">
			<Box flex="1" minW={0}>
				<Text sx={cardStyles.label}>{label}</Text>
				<Text sx={cardStyles.value}>{value}</Text>
			</Box>
			<Flex
				sx={{
					...cardStyles.iconCircle,
					bg: iconBg,
					color: iconColor,
				}}
			>
				{icon}
			</Flex>
		</Flex>
	</Box>
)

const EMPTY_SUMMARY_VALUE = '—'

const InvoiceSummaryCards = () => {
	const { t } = useTranslation()
	const { formatAmount } = useInvoiceDisplayCurrency()
	const {
		data: cashBalances,
		isLoading: isCashLoading,
		isFetching: isCashFetching,
		isError: isCashError,
	} = useGetCashAccountBalancesQuery(undefined, {
		refetchOnMountOrArgChange: false,
	})

	const formatLedgerBalance = (amount: number | undefined) => {
		if (isCashError) return t('dashboard.kpi.error')
		if (amount == null) return EMPTY_SUMMARY_VALUE
		return formatAmount(amount)
	}

	const balanceByType = new Map(
		(cashBalances?.accounts ?? []).map(account => [
			account.type,
			account.balance,
		]),
	)
	const showCashLoading = isCashLoading || (isCashFetching && !cashBalances)

	return (
		<Box mb={6}>
			<Flex gap={4} flexWrap="wrap">
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
			</Flex>
		</Box>
	)
}

export default InvoiceSummaryCards
