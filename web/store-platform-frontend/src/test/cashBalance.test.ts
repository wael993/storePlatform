import { describe, expect, it } from 'vitest'

import { DailyActionType } from '../shared/globalEnums'
import {
	calculateCashBalance,
	type CashBalanceDateRange,
} from '../components/SellingInvoice/cashBalance'
import type { DisplayCurrencyOption } from '../components/SellingInvoice/currencyDisplay'
import type { ApiSellingInvoice } from '../components/SellingInvoice/invoiceApiMappers'
import type { ApiBuyingInvoice } from '../components/BuyingInvoice/buyingInvoiceApiMappers'

const primaryOptions: DisplayCurrencyOption[] = [
	{
		currencyId: 'primary',
		label: 'SYP',
		name: 'SYP',
		exchangeRate: 1,
	},
]

const range: CashBalanceDateRange = {
	dateFrom: '2026-07-01',
	dateTo: '2026-07-01',
}

const receipt: DailyAction = {
	actionId: 'r1',
	entryType: DailyActionType.RECEIPT_ENTRY,
	currencyId: 'primary',
	currencyName: 'SYP',
	invoiceDate: '2026-07-01',
	singleUnitPrice: '100',
}

const payment: DailyAction = {
	actionId: 'p1',
	entryType: DailyActionType.PAYMENT_ENTRY,
	currencyId: 'primary',
	currencyName: 'SYP',
	invoiceDate: '2026-07-01',
	singleUnitPrice: '40',
}

describe('calculateCashBalance', () => {
	it('subtracts payments from receipts', () => {
		expect(
			calculateCashBalance({
				dailyActions: [receipt, payment],
				sellingInvoices: [],
				buyingInvoices: [],
				range,
				displayCurrencyOptions: primaryOptions,
			}),
		).toBe(60)
	})

	it('ignores selling and buying invoices outside the date range', () => {
		expect(
			calculateCashBalance({
				dailyActions: [receipt],
				sellingInvoices: [
					{
						issuedAt: '2026-06-01',
						createdAt: '2026-06-01',
					} as ApiSellingInvoice,
				],
				buyingInvoices: [
					{
						issuedAt: '2026-08-01',
						createdAt: '2026-08-01',
					} as ApiBuyingInvoice,
				],
				range,
				displayCurrencyOptions: primaryOptions,
			}),
		).toBe(100)
	})
})
