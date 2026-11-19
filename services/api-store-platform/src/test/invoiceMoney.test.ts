import { describe, expect, it, vi } from 'vitest'

import {
	assertInvoiceMoney,
	checkInvoiceRequestMoney,
	invoiceRequestTotals,
} from '../shared/invoiceMoney'
import { calculateInvoiceTotals } from '../shared/store-domain'

vi.mock('../shared/cashAccounts/posting', () => ({
	loadCashCurrencyRates: vi.fn(async () => [
		{ currencyId: 'usd', label: 'USD', name: 'USD', exchangeRate: 1 },
		{ currencyId: 'syp', label: 'SYP', name: 'SYP', exchangeRate: 15000 },
	]),
}))

const items = [
	{ quantity: 2, unitPrice: 1.5, discount: 1, discountIsPercent: true },
	{ quantity: 1, unitPrice: 10, discount: 0, discountIsPercent: false },
]

/** Built like the web app's buildInvoiceCurrencyAmounts. */
const webRequest = (sypRate = 15000, paid = 5) => {
	const totals = calculateInvoiceTotals(items)
	const row = (currencyId: string, rate: number, isPrimary: boolean) => ({
		currencyId,
		isPrimary,
		exchangeRate: rate,
		amount: totals.grandTotal * rate,
		paidAmount: paid * rate,
		remainingAmount: (totals.grandTotal - paid) * rate,
		subtotal: totals.subtotal * rate,
		discount: totals.discount * rate,
	})

	return {
		items,
		currencyAmounts: [row('usd', 1, true), row('syp', sypRate, false)],
	}
}

const todayRates = new Map([
	['usd', 1],
	['syp', 15000],
])

const refused = (patch: (r: ReturnType<typeof webRequest>) => void) => {
	const request = webRequest()

	patch(request)

	return () => assertInvoiceMoney({ ...request, todayRates })
}

describe('assertInvoiceMoney', () => {
	it('accepts what the web app sends (percent discount, float total 12.97)', () => {
		expect(() =>
			assertInvoiceMoney({ ...webRequest(), todayRates }),
		).not.toThrow()
	})

	it('refuses a rate of 0 or below instead of treating it as 1', () => {
		expect(
			refused(r => {
				r.currencyAmounts[1].exchangeRate = 0
			}),
		).toThrow('positive')

		expect(
			refused(r => {
				r.currencyAmounts[1].exchangeRate = -5
			}),
		).toThrow('positive')
	})

	it('refuses a total that does not follow from the lines', () => {
		expect(
			refused(r => {
				r.currencyAmounts[0].amount = 1
			}),
		).toThrow('do not match its lines')
	})

	it('refuses a secondary amount that is not primary × rate', () => {
		expect(
			refused(r => {
				r.currencyAmounts[1].amount = 1
			}),
		).toThrow('exchange rates')
	})

	it('refuses paid above the total and paid + remaining off the total', () => {
		expect(
			refused(r => {
				r.currencyAmounts[0].paidAmount = 100
			}),
		).toThrow('Paid amount')

		expect(
			refused(r => {
				r.currencyAmounts[0].remainingAmount = 0
			}),
		).toThrow('add up')
	})

	it('refuses a missing or second primary row', () => {
		expect(
			refused(r => {
				r.currencyAmounts[0].isPrimary = false
			}),
		).toThrow('exactly one primary')
	})

	it("live: refuses a rate that is not today's (decision A)", () => {
		expect(() =>
			assertInvoiceMoney({ ...webRequest(13000), todayRates }),
		).toThrow('Exchange rates changed')
	})

	it('sync replay: keeps the rate it was created with', () => {
		expect(() => assertInvoiceMoney(webRequest(13000))).not.toThrow()
	})
})

describe('checkInvoiceRequestMoney', () => {
	const base = { tenantId: 't-1' }

	it("live create with today's rates passes, an old rate is refused", async () => {
		await expect(
			checkInvoiceRequestMoney({
				...base,
				request: webRequest(),
				isSyncReplay: false,
			}),
		).resolves.toBeUndefined()

		await expect(
			checkInvoiceRequestMoney({
				...base,
				request: webRequest(13000),
				isSyncReplay: false,
			}),
		).rejects.toThrow('Exchange rates changed')
	})

	it('replay with an old rate passes', async () => {
		await expect(
			checkInvoiceRequestMoney({
				...base,
				request: webRequest(13000),
				isSyncReplay: true,
			}),
		).resolves.toBeUndefined()
	})

	it('edit without money fields is not checked', async () => {
		await expect(
			checkInvoiceRequestMoney({
				...base,
				request: {},
				stored: { items, currencyAmounts: [] },
				isSyncReplay: false,
			}),
		).resolves.toBeUndefined()
	})

	it('edit of the lines without new amounts is refused (stored total no longer fits)', async () => {
		await expect(
			checkInvoiceRequestMoney({
				...base,
				request: { items: [{ ...items[0], quantity: 5 }] },
				stored: webRequest(),
				isSyncReplay: false,
			}),
		).rejects.toThrow('do not match its lines')
	})

	it('stored amounts keep their old rate on edit (no live check)', async () => {
		await expect(
			checkInvoiceRequestMoney({
				...base,
				request: { items },
				stored: webRequest(13000),
				isSyncReplay: false,
			}),
		).resolves.toBeUndefined()
	})
})

describe('invoiceRequestTotals', () => {
	it('applies line and invoice discounts and ignores a client lineTotal', () => {
		const items = [
			{
				quantity: 1,
				unitPrice: 100,
				discount: 10,
				discountIsPercent: true,
				lineTotal: 0.01,
			},
		]

		expect(invoiceRequestTotals({ items })).toMatchObject({
			subtotal: 100,
			grandTotal: 90,
		})

		// the shared web formula: an invoice discount replaces the line discounts
		expect(
			invoiceRequestTotals({ items, invoiceDiscount: 5 }).grandTotal,
		).toBe(95)
	})
})
