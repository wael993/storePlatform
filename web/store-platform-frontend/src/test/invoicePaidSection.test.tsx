import { ChakraProvider } from '@chakra-ui/react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DisplayCurrencyOption } from '../components/SellingInvoice/currencyDisplay'
import InvoicePaidSection from '../components/SellingInvoice/InvoicePaidSection'

const options: DisplayCurrencyOption[] = [
	{ currencyId: 'syp', label: 'SYP', name: 'Syrian Pound', exchangeRate: 1 },
	{ currencyId: 'usd', label: 'USD', name: 'US Dollar', exchangeRate: 2 },
	{ currencyId: 'eur', label: 'EUR', name: 'Euro', exchangeRate: 0.9 },
]

const renderSection = (
	overrides: Partial<{
		options: DisplayCurrencyOption[]
		paidAmount: number
		onSettlement: (paidAmount: number, cashTendered: number | null) => void
	}> = {},
) =>
	render(
		<ChakraProvider>
			<InvoicePaidSection
				paidLabel="Paid Amount"
				changeLabel="Change"
				options={overrides.options ?? options}
				displayCurrencyId="syp"
				grandTotal={100}
				paidAmount={overrides.paidAmount ?? 100}
				cashTendered={null}
				isEditable
				onSettlement={overrides.onSettlement ?? vi.fn()}
			/>
		</ChakraProvider>,
	)

describe('InvoicePaidSection', () => {
	afterEach(() => {
		cleanup()
	})

	it('adds the next currency at 0 and shows change in that currency', async () => {
		const user = userEvent.setup()
		const onSettlement = vi.fn()
		renderSection({ paidAmount: 40, onSettlement })

		expect(screen.queryByRole('button', { name: 'Remove currency' })).toBeNull()
		expect(screen.getByText('-60 SYP')).toBeTruthy()

		await user.click(screen.getByRole('button', { name: 'Add Currency' }))
		expect(screen.getByText('0 USD')).toBeTruthy()
		expect(screen.getByText('-120 USD')).toBeTruthy()
		expect(screen.queryByText('-60 SYP')).toBeNull()

		await user.click(screen.getByText('0 USD'))
		await user.clear(screen.getByRole('textbox'))
		await user.type(screen.getByRole('textbox'), '10{Enter}')

		expect(screen.getByText('10 USD')).toBeTruthy()
		expect(screen.getByText('-110 USD')).toBeTruthy()
		const lastCall = onSettlement.mock.calls.at(-1)
		expect(lastCall?.[0]).toBe(45)
		expect(lastCall?.[1]).toBeNull()
		expect(lastCall?.[2]).toEqual(
			expect.arrayContaining([
				{ currencyId: 'syp', tenderedAmount: 40 },
				{ currencyId: 'usd', tenderedAmount: 10 },
			]),
		)

		await user.click(screen.getByRole('button', { name: 'Add Currency' }))
		expect(screen.getByText('0 EUR')).toBeTruthy()
		expect(screen.getByText('-49.5 EUR')).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Add Currency' })).toBeNull()
		expect(
			screen.getAllByRole('button', { name: 'Remove currency' }),
		).toHaveLength(3)
	})

	it('hides the plus when the invoice has no other currency', () => {
		renderSection({ options: [options[0]] })

		expect(screen.queryByRole('button', { name: 'Add Currency' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Remove currency' })).toBeNull()
		expect(screen.getByText('100 SYP')).toBeTruthy()
		expect(screen.getByText('0 SYP')).toBeTruthy()
	})

	it('removes a currency row and puts the plus back on the last one', async () => {
		const user = userEvent.setup()
		renderSection({ paidAmount: 40 })

		await user.click(screen.getByRole('button', { name: 'Add Currency' }))
		expect(
			screen.getAllByRole('button', { name: 'Remove currency' }),
		).toHaveLength(1)
		expect(screen.getByRole('button', { name: 'Add Currency' })).toBeTruthy()

		await user.click(screen.getByRole('button', { name: 'Add Currency' }))
		await user.click(
			screen.getAllByRole('button', { name: 'Remove currency' })[2],
		)

		expect(screen.queryByText('0 EUR')).toBeNull()
		expect(screen.getByRole('button', { name: 'Add Currency' })).toBeTruthy()
		expect(
			screen.getAllByRole('button', { name: 'Remove currency' }),
		).toHaveLength(1)
		expect(screen.getByText('-120 USD')).toBeTruthy()
	})
})
