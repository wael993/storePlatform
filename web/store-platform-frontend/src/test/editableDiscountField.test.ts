import { describe, expect, it } from 'vitest'

import type { DisplayCurrencyOption } from '../components/SellingInvoice/currencyDisplay'
import {
	formatDiscountEditDraft,
	parseDiscountInput,
	toPrimaryDiscountSave,
} from '../components/SellingInvoice/discountInput'

/** Primary SYP, display USD: 1 USD = 10,000 SYP → USD rate = 1/10000. */
const options: DisplayCurrencyOption[] = [
	{ currencyId: 'syp', label: 'SYP', name: 'Syrian Pound', exchangeRate: 1 },
	{
		currencyId: 'usd',
		label: 'USD',
		name: 'US Dollar',
		exchangeRate: 1 / 10000,
	},
]

const wouldSave = (
	draftInput: string,
	storedDiscount: number,
	storedIsPercent: boolean,
	displayCurrencyId: string | null,
	currencyOptions: DisplayCurrencyOption[],
) => {
	const parsed = parseDiscountInput(draftInput)
	if (!parsed) return false

	const primary = toPrimaryDiscountSave(
		parsed,
		displayCurrencyId,
		currencyOptions,
	)

	return (
		primary.discount !== storedDiscount ||
		primary.discountIsPercent !== storedIsPercent
	)
}

describe('EditableDiscountField display-currency conversion', () => {
	it('converts absolute primary discount to display currency for the edit draft', () => {
		expect(formatDiscountEditDraft(100_000, false, 'usd', options)).toBe('10')
		expect(formatDiscountEditDraft(100_000, false, 'usd', options)).not.toBe(
			'100000',
		)
	})

	it('converts absolute display edit back to primary on save', () => {
		const parsed = parseDiscountInput('1')
		if (!parsed) throw new Error('Invalid discount input')
		expect(parsed).toEqual({ discount: 1, discountIsPercent: false })
		expect(toPrimaryDiscountSave(parsed, 'usd', options)).toEqual({
			discount: 10_000,
			discountIsPercent: false,
		})
	})

	it('does not convert percentage discounts', () => {
		expect(formatDiscountEditDraft(10, true, 'usd', options)).toBe('10%')
		expect(
			toPrimaryDiscountSave(
				{ discount: 10, discountIsPercent: true },
				'usd',
				options,
			),
		).toEqual({ discount: 10, discountIsPercent: true })
	})

	it('skips onSave when the display value maps to the same primary amount', () => {
		expect(wouldSave('10', 100_000, false, 'usd', options)).toBe(false)
		expect(wouldSave('1', 100_000, false, 'usd', options)).toBe(true)

		const parsed = parseDiscountInput('1')
		if (!parsed) throw new Error('Expected discount input to parse')

		expect(toPrimaryDiscountSave(parsed, 'usd', options).discount).toBe(10_000)
	})

	it('leaves absolute discounts unchanged when primary and display match', () => {
		expect(formatDiscountEditDraft(100_000, false, 'syp', options)).toBe(
			'100,000',
		)
		expect(
			toPrimaryDiscountSave(
				{ discount: 5, discountIsPercent: false },
				'syp',
				options,
			),
		).toEqual({ discount: 5, discountIsPercent: false })
	})
})
