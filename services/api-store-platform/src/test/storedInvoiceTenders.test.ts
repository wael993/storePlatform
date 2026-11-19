import { describe, expect, it } from 'vitest'

import { storedInvoiceTenders } from '../shared/cashAccounts/posting'

const amounts = (sypRate: number) => [
	{ currencyId: 'usd', isPrimary: true, exchangeRate: 1, amount: 10 },
	{
		currencyId: 'syp',
		isPrimary: false,
		exchangeRate: sypRate,
		amount: 10 * sypRate,
	},
]

describe('storedInvoiceTenders', () => {
	it('allocates a foreign tender with the snapshot rate', () => {
		const [tender] = storedInvoiceTenders(
			[{ currencyId: 'syp', tenderedAmount: 150000 }],
			amounts(15000),
		)

		expect(tender.appliedAmount).toBe(150000)
	})

	it('refuses a rate of 0 instead of valuing the tender 1 : 1', () => {
		expect(() =>
			storedInvoiceTenders(
				[{ currencyId: 'syp', tenderedAmount: 10 }],
				amounts(0),
			),
		).toThrow('positive')
	})
})
