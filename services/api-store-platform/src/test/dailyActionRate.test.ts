import { describe, expect, it } from 'vitest'

import { resolveDailyActionRate } from '../shared/dailyActionRate'

const rates = [
	{ currencyId: 'usd', label: 'USD', name: 'USD', exchangeRate: 1 },
	{ currencyId: 'syp', label: 'SYP', name: 'SYP', exchangeRate: 15000 },
]

describe('resolveDailyActionRate', () => {
	it("takes today's settings rate for a live create", () => {
		expect(resolveDailyActionRate({ currencyId: 'syp', rates })).toBe(15000)
	})

	it('keeps the rate the device stamped offline on sync replay', () => {
		expect(
			resolveDailyActionRate({
				currencyId: 'syp',
				rates,
				replaySnapshot: 13000,
			}),
		).toBe(13000)
	})

	it('falls back to settings when a replay has no usable snapshot', () => {
		for (const replaySnapshot of [undefined, 0, -5, Number.NaN, '13000']) {
			expect(
				resolveDailyActionRate({ currencyId: 'syp', rates, replaySnapshot }),
			).toBe(15000)
		}
	})

	it('keeps the stored rate when an edit keeps the currency', () => {
		expect(
			resolveDailyActionRate({
				currencyId: 'syp',
				rates,
				existing: { currencyId: 'syp', exchangeRateToPrimary: 13000 },
			}),
		).toBe(13000)
	})

	it('takes a new rate when an edit changes the currency', () => {
		expect(
			resolveDailyActionRate({
				currencyId: 'syp',
				rates,
				existing: { currencyId: 'usd', exchangeRateToPrimary: 1 },
			}),
		).toBe(15000)
	})

	it('refuses a currency that is not in the settings instead of valuing it 1 : 1', () => {
		expect(() => resolveDailyActionRate({ currencyId: 'eur', rates })).toThrow(
			'Currency is not in the currency settings.',
		)
	})
})
