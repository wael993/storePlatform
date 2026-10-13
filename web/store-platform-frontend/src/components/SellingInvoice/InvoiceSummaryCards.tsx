import { Box, Flex, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PAGE_COLORS } from './constants'
import {
	useGetCashAccountBalancesQuery,
	useGetCurrencySettingsQuery,
} from '../../api/apiStore'
import {
	CashCurrencyBalanceList,
	CashCurrencyExpandButton,
	cashCurrencyLines,
	type CashCurrencyLine,
} from '../dashboard/cashCurrencyBalances'
const cardStyles = {
	base: {
		position: 'relative',
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
} satisfies StylesObject

const CashSummaryCard = ({
	label,
	lines,
	fallback,
}: {
	label: string
	lines?: CashCurrencyLine[]
	fallback: string
}) => {
	const [expanded, setExpanded] = useState(false)
	const canExpand = (lines?.length ?? 0) > 2

	return (
		<Box sx={cardStyles.base}>
			{canExpand ? (
				<CashCurrencyExpandButton
					expanded={expanded}
					onToggle={() => setExpanded(open => !open)}
				/>
			) : null}
			<Text sx={cardStyles.label} pr={canExpand ? 8 : undefined}>
				{label}
			</Text>
			{lines && lines.length > 0 ? (
				<CashCurrencyBalanceList lines={lines} expanded={expanded} flush />
			) : (
				<Text sx={cardStyles.value}>{fallback}</Text>
			)}
		</Box>
	)
}

const EMPTY_SUMMARY_VALUE = '—'

const InvoiceSummaryCards = () => {
	const { t } = useTranslation()
	const { data: currencySettings } = useGetCurrencySettingsQuery(undefined, {
		refetchOnMountOrArgChange: false,
	})
	const {
		data: cashBalances,
		isLoading: isCashLoading,
		isFetching: isCashFetching,
		isError: isCashError,
	} = useGetCashAccountBalancesQuery(undefined, {
		refetchOnMountOrArgChange: false,
	})

	const balancesByType = new Map(
		(cashBalances?.accounts ?? []).map(account => [
			account.type,
			account.balances,
		]),
	)
	const showCashLoading = isCashLoading || (isCashFetching && !cashBalances)

	const linesFor = (balances: Record<string, number> | undefined) => {
		if (showCashLoading || isCashError || !balances) return undefined
		const lines = cashCurrencyLines(currencySettings, balances)
		return lines.length > 0 ? lines : undefined
	}

	const fallbackFor = (balances: Record<string, number> | undefined) => {
		if (isCashError) return t('dashboard.kpi.error')
		if (showCashLoading) return t('dashboard.kpi.loading')
		if (!balances) return EMPTY_SUMMARY_VALUE
		return EMPTY_SUMMARY_VALUE
	}

	return (
		<Box mb={6}>
			<Flex gap={4} flexWrap="wrap" alignItems="flex-start">
				<CashSummaryCard
					label={t('dashboard.cashAccounts.dailyCash')}
					lines={linesFor(balancesByType.get('daily_cash'))}
					fallback={fallbackFor(balancesByType.get('daily_cash'))}
				/>
				<CashSummaryCard
					label={t('dashboard.cashAccounts.cashReserve')}
					lines={linesFor(balancesByType.get('cash_reserve'))}
					fallback={fallbackFor(balancesByType.get('cash_reserve'))}
				/>
				<CashSummaryCard
					label={t('dashboard.cashAccounts.online')}
					lines={linesFor(balancesByType.get('online'))}
					fallback={fallbackFor(balancesByType.get('online'))}
				/>
			</Flex>
		</Box>
	)
}

export default InvoiceSummaryCards
