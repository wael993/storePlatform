import { describe, expect, it } from 'vitest'

import {
	resolveAdditionalCurrencyRows,
	type DisplayCurrencyOption,
} from '../components/SellingInvoice/currencyDisplay'

const options: DisplayCurrencyOption[] = [
	{ currencyId: 'syp', label: 'SYP', name: 'Syrian Pound', exchangeRate: 1 },
	{ currencyId: 'usd', label: 'USD', name: 'US Dollar', exchangeRate: 0.01 },
	{ currencyId: 'eur', label: 'EUR', name: 'Euro', exchangeRate: 0.009 },
]

describe('resolveAdditionalCurrencyRows', () => {
	it('offers the next currency that is not already on the invoice', () => {
		expect(resolveAdditionalCurrencyRows(options, ['syp'])).toEqual({
			shownCurrencyIds: ['syp'],
			nextCurrencyId: 'usd',
		})
	})

	it('adds one currency per click and never repeats one', () => {
		expect(resolveAdditionalCurrencyRows(options, ['syp', 'usd'])).toEqual({
			shownCurrencyIds: ['syp', 'usd'],
			nextCurrencyId: 'eur',
		})
		expect(
			resolveAdditionalCurrencyRows(options, ['syp', 'usd', 'eur', 'usd']),
		).toEqual({
			shownCurrencyIds: ['syp', 'usd', 'eur'],
			nextCurrencyId: null,
		})
	})

	it('drops unknown ids and offers a removed currency again', () => {
		expect(resolveAdditionalCurrencyRows(options, ['usd', 'gbp'])).toEqual({
			shownCurrencyIds: ['usd'],
			nextCurrencyId: 'syp',
		})
	})

	it('offers nothing when the invoice has a single currency', () => {
		expect(resolveAdditionalCurrencyRows([options[0]], ['syp'])).toEqual({
			shownCurrencyIds: ['syp'],
			nextCurrencyId: null,
		})
	})
})
