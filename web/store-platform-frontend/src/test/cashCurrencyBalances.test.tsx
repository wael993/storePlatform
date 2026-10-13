import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CashKpiCard } from '../components/dashboard/CashPaymentsCard'
import {
	cashCurrencyLines,
	type CashCurrencyLine,
} from '../components/dashboard/cashCurrencyBalances'

const settings = {
	primaryCurrency: {
		currencyId: 'usd',
		name: 'US Dollar',
		internalCode: 'USD',
	},
	secondaryCurrencies: [
		{ currencyId: 'syp', name: 'Syrian Pound', internalCode: 'SYP' },
		{ currencyId: 'eur', name: 'Euro', internalCode: 'EUR' },
	],
}

const line = (
	currencyId: string,
	code: string,
	amount: number,
): CashCurrencyLine => ({ currencyId, code, amount })

const dailyLines = [
	line('usd', 'USD', 1250),
	line('syp', 'SYP', 0),
	line('eur', 'EUR', 7),
]

const reserveLines = [
	line('usd', 'USD', 10),
	line('syp', 'SYP', 0),
	line('jpy', 'JPY', 3),
]

const renderCards = (lines: CashCurrencyLine[], onOpen = vi.fn()) =>
	render(
		<ChakraProvider>
			<CashKpiCard
				cardKey="daily_cash"
				title="Daily Cash"
				value=""
				lines={lines}
				onOpen={onOpen}
			/>
			<CashKpiCard
				cardKey="cash_reserve"
				title="Cash Reserve"
				value=""
				lines={reserveLines}
			/>
		</ChakraProvider>,
	)

describe('cashCurrencyLines', () => {
	it('keeps the primary currency first and shows zeros for the rest', () => {
		expect(cashCurrencyLines(settings, { usd: 1250 })).toEqual([
			line('usd', 'USD', 1250),
			line('syp', 'SYP', 0),
			line('eur', 'EUR', 0),
		])
	})

	it('does not add balances from different currencies', () => {
		const lines = cashCurrencyLines(settings, { usd: 1250, syp: 4000 })

		expect(lines.map(entry => entry.amount)).toEqual([1250, 4000, 0])
	})
})

describe('CashKpiCard currencies', () => {
	afterEach(() => {
		cleanup()
	})

	it('shows every configured currency, including zero, when there are two or fewer', () => {
		render(
			<ChakraProvider>
				<CashKpiCard
					cardKey="daily_cash"
					title="Daily Cash"
					value=""
					lines={[line('usd', 'USD', 1250), line('syp', 'SYP', 0)]}
				/>
			</ChakraProvider>,
		)

		expect(screen.getByText('1,250 USD')).toBeTruthy()
		expect(screen.getByText('0 SYP')).toBeTruthy()
		expect(
			screen.queryByRole('button', { name: 'Show all currencies' }),
		).toBeNull()
	})

	it('expands and collapses one card without changing the other', async () => {
		const user = userEvent.setup()
		const onOpen = vi.fn()
		const { rerender } = renderCards(dailyLines, onOpen)

		expect(screen.getByText('1,250 USD')).toBeTruthy()
		expect(screen.getAllByText('0 SYP')).toHaveLength(2)
		expect(screen.queryByText('7 EUR')).toBeNull()
		expect(screen.queryByText('3 JPY')).toBeNull()
		expect(
			screen.getAllByRole('button', { name: 'Show all currencies' }),
		).toHaveLength(2)

		await user.click(
			screen.getAllByRole('button', { name: 'Show all currencies' })[0],
		)

		expect(onOpen).not.toHaveBeenCalled()
		expect(screen.getByText('7 EUR')).toBeTruthy()
		expect(screen.queryByText('3 JPY')).toBeNull()
		expect(
			screen.getAllByRole('button', { name: 'Show all currencies' }),
		).toHaveLength(1)

		await user.click(
			screen.getByRole('button', { name: 'Show fewer currencies' }),
		)

		expect(screen.queryByText('7 EUR')).toBeNull()
		expect(screen.queryByText('3 JPY')).toBeNull()

		rerender(
			<ChakraProvider>
				<CashKpiCard
					cardKey="daily_cash"
					title="Daily Cash"
					value=""
					lines={[line('usd', 'USD', 20), line('syp', 'SYP', 5)]}
					onOpen={onOpen}
				/>
				<CashKpiCard
					cardKey="cash_reserve"
					title="Cash Reserve"
					value=""
					lines={reserveLines}
				/>
			</ChakraProvider>,
		)

		expect(screen.getByText('20 USD')).toBeTruthy()
		expect(screen.getByText('5 SYP')).toBeTruthy()
		expect(screen.queryByText('7 EUR')).toBeNull()
		expect(
			screen.getAllByRole('button', { name: 'Show all currencies' }),
		).toHaveLength(1)
		expect(screen.queryByText('3 JPY')).toBeNull()
	})
})
