import { describe, expect, it } from 'vitest'

import { catalogAmountFromPrimary } from '../components/SellingInvoice/currencyDisplay'

describe('catalogAmountFromPrimary', () => {
	const options = [
		{ currencyId: 'usd', label: 'USD', name: 'US Dollar', exchangeRate: 1 },
		{
			currencyId: 'syp',
			label: 'SYP',
			name: 'Syrian Pound',
			exchangeRate: 100,
		},
	]

	it('returns null when product currency is unresolved', () => {
		expect(catalogAmountFromPrimary(8.90151515, undefined, options)).toBeNull()
		expect(catalogAmountFromPrimary(10, 'XYZ', options)).toBeNull()
	})

	it('converts primary to product currency for catalog retailPrice', () => {
		expect(catalogAmountFromPrimary(10, 'SYP', options)).toBe(1000)
		expect(catalogAmountFromPrimary(10, 'USD', options)).toBe(10)
	})
})
