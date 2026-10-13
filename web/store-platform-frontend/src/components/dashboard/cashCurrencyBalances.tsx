import { Box, IconButton, Text } from '@chakra-ui/react'
import { ChevronDownIcon } from '@chakra-ui/icons'
import { useTranslation } from 'react-i18next'

import { currencyBalanceOf } from 'store-domain'

import type { CurrencySettingItem, CurrencySettings } from '../../api/apiStore'
import { formatNumber } from '../../shared/utils'

export type CashCurrencyLine = {
	currencyId: string
	code: string
	amount: number
}

const COMPACT_CURRENCY_COUNT = 2

const currencyCode = (currency: CurrencySettingItem) =>
	currency.internalCode?.trim() || currency.name?.trim() || ''

/**
 * Primary currency first, then secondary currencies in settings order.
 * A missing balance for a currency is zero.
 */
export const cashCurrencyLines = (
	settings:
		| Pick<CurrencySettings, 'primaryCurrency' | 'secondaryCurrencies'>
		| null
		| undefined,
	balances: Record<string, number> | null | undefined,
): CashCurrencyLine[] => {
	const primary = settings?.primaryCurrency
	if (!primary?.currencyId) return []

	const seen = new Set<string>()
	const currencies = [primary, ...(settings?.secondaryCurrencies ?? [])]

	return currencies.flatMap(currency => {
		const currencyId = currency.currencyId?.trim()
		if (!currencyId || seen.has(currencyId)) return []
		seen.add(currencyId)

		return [
			{
				currencyId,
				code: currencyCode(currency),
				amount: currencyBalanceOf(balances, currencyId),
			},
		]
	})
}

export const formatCashCurrencyAmount = (line: CashCurrencyLine) => {
	const formatted = formatNumber(line.amount) ?? '0'
	return line.code ? `${formatted} ${line.code}` : formatted
}

const stackStyles = {
	single: {
		mt: { base: 4, lg: 3 },
		fontSize: { base: 'xl', sm: '2xl', lg: 'xl' },
		fontWeight: 800,
		lineHeight: '1',
	},
	lines: {
		mt: { base: 3, lg: 2 },
		fontSize: { base: 'md', lg: 'sm' },
		fontWeight: 700,
		lineHeight: '1.3',
	},
} satisfies StylesObject

const visibleCashCurrencyLines = (
	lines: CashCurrencyLine[],
	expanded: boolean,
) =>
	lines.length > COMPACT_CURRENCY_COUNT && !expanded
		? lines.slice(0, COMPACT_CURRENCY_COUNT)
		: lines

export const CashCurrencyExpandButton = ({
	expanded,
	onToggle,
}: {
	expanded: boolean
	onToggle: () => void
}) => {
	const { t } = useTranslation()

	return (
		<IconButton
			aria-label={
				expanded
					? t('dashboard.cashAccounts.showFewerCurrencies')
					: t('dashboard.cashAccounts.showAllCurrencies')
			}
			aria-expanded={expanded}
			icon={
				<ChevronDownIcon transform={expanded ? 'rotate(180deg)' : undefined} />
			}
			type="button"
			position="absolute"
			top={{ base: 3, lg: 2 }}
			right={{ base: 3, lg: 2 }}
			zIndex={2}
			size="xs"
			variant="ghost"
			color="gray.500"
			minW="1.5rem"
			h="1.5rem"
			onClick={event => {
				event.stopPropagation()
				onToggle()
			}}
		/>
	)
}

export const CashCurrencyBalanceList = ({
	lines,
	expanded,
	flush = false,
}: {
	lines: CashCurrencyLine[]
	expanded: boolean
	/** Drop the dashboard gap when the parent label already separates the amounts. */
	flush?: boolean
}) => {
	const shown = visibleCashCurrencyLines(lines, expanded)
	const prominent = lines.length === 1
	const scrolling = lines.length > COMPACT_CURRENCY_COUNT && expanded
	const stack = prominent ? stackStyles.single : stackStyles.lines

	return (
		<Box
			sx={flush ? { ...stack, mt: 0 } : stack}
			color="gray.900"
			minW={0}
			// note: extra currencies scroll inside the card so a taller card cannot stretch the dashboard row
			maxH={scrolling ? '4rem' : undefined}
			overflowY={scrolling ? 'auto' : 'hidden'}
		>
			{shown.map(line => (
				<Text key={line.currencyId} noOfLines={1}>
					{formatCashCurrencyAmount(line)}
				</Text>
			))}
		</Box>
	)
}
