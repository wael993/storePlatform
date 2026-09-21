import { describe, expect, it } from 'vitest'
import {
	catalogCostToPrimary,
	ratesFromCurrencySettings,
} from '../shared/inventoryCost'
import { matchConfiguredCurrencyLabel } from '../shared/productImport/importCurrency'

/** Primary EUR; 1 USD = 0.92 EUR → USD.exchangeRate = 1/0.92 (primary→display). */
const eurPrimaryRates = ratesFromCurrencySettings({
	primaryCurrency: {
		currencyId: 'eur',
		name: 'Euro',
		internalCode: 'EUR',
	},
	secondaryCurrencies: [
		{
			currencyId: 'usd',
			name: 'US Dollar',
			internalCode: 'USD',
			exchangeRate: 1 / 0.92,
		},
	],
})

const eurPrimarySettings = {
	primaryCurrency: {
		currencyId: 'eur',
		name: 'Euro',
		internalCode: 'EUR',
	},
	secondaryCurrencies: [
		{
			currencyId: 'usd',
			name: 'US Dollar',
			internalCode: 'USD',
			exchangeRate: 1 / 0.92,
		},
	],
}

describe('product import currency + opening cost', () => {
	it('resolves configured catalog currency labels and rejects unknown codes', () => {
		expect(matchConfiguredCurrencyLabel('USD', eurPrimarySettings)).toBe('USD')
		expect(matchConfiguredCurrencyLabel('usd', eurPrimarySettings)).toBe('USD')
		expect(matchConfiguredCurrencyLabel('Euro', eurPrimarySettings)).toBe('EUR')
		expect(matchConfiguredCurrencyLabel('SYP', eurPrimarySettings)).toBeNull()
		expect(matchConfiguredCurrencyLabel('', eurPrimarySettings)).toBeNull()
		expect(matchConfiguredCurrencyLabel('USD', null)).toBeNull()
	})

	it('seeds opening averageCost in primary from purchasePrice + selected currency', () => {
		const currency = matchConfiguredCurrencyLabel('USD', eurPrimarySettings)
		const averageCost = catalogCostToPrimary(
			10,
			currency ?? undefined,
			eurPrimaryRates,
		)

		expect(currency).toBe('USD')
		expect(averageCost).toBe(9.2)
	})
})
