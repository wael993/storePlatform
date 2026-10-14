import { describe, expect, it } from 'vitest'
import type { CostCurrencyRate } from 'store-domain'

import { DailyActionType, InvoiceStatus } from '../shared/globalEnums'
import {
	customerPartySummary,
	customerRelatedEntries,
	supplierPartySummary,
	supplierRelatedEntries,
} from '../offline/partyInvoiceSummary'

const entry = (
	entryType: DailyActionType,
	totalPrice: string,
	extra: Partial<DailyAction> = {},
): DailyAction =>
	({
		actionId: totalPrice + entryType,
		entryType,
		currencyId: '',
		currencyName: '',
		invoiceDate: '',
		totalPrice,
		...extra,
	}) as DailyAction

const invoice = (
	amount: number,
	paidAmount = 0,
	status = InvoiceStatus.CONFIRMED,
) => ({
	status,
	amount,
	paidAmount,
	remainingAmount: amount - paidAmount,
})

const usdSypRates: CostCurrencyRate[] = [
	{ currencyId: 'usd', label: '$', name: 'USD', exchangeRate: 1 },
	{ currencyId: 'syp', label: 'SYP', name: 'ليرة', exchangeRate: 140 },
]

describe('offline party invoice summary', () => {
	it('adds a customer payment and a supplier receipt, and subtracts the opposite entry', () => {
		const customer = customerPartySummary(
			[invoice(100)],
			[
				entry(DailyActionType.PAYMENT_ENTRY, '25'),
				entry(DailyActionType.RECEIPT_ENTRY, '10'),
			],
			[],
		)
		const supplier = supplierPartySummary(
			[invoice(80)],
			[
				entry(DailyActionType.PAYMENT_ENTRY, '20'),
				entry(DailyActionType.RECEIPT_ENTRY, '30'),
			],
			[],
		)

		expect(customer.outstanding).toBe(115)
		expect(supplier.outstanding).toBe(90)
	})

	it('nets a purchase against customer receivable and a sale against supplier payable', () => {
		expect(
			customerPartySummary([invoice(100)], [], [invoice(40)]).outstanding,
		).toBe(60)
		expect(
			supplierPartySummary([invoice(80)], [], [invoice(50, 10)]).outstanding,
		).toBe(40)
	})

	it('keeps a supplier overpayment as money owed to us', () => {
		expect(
			supplierPartySummary(
				[invoice(40)],
				[entry(DailyActionType.PAYMENT_ENTRY, '100')],
				[],
			).outstanding,
		).toBe(-60)
	})

	it('converts a 10000 SYR payment or receipt into primary dollars', () => {
		const customer = customerPartySummary(
			[],
			[entry(DailyActionType.RECEIPT_ENTRY, '10000', { currencyId: 'syp' })],
			[],
			usdSypRates,
		)
		const supplier = supplierPartySummary(
			[],
			[entry(DailyActionType.PAYMENT_ENTRY, '10000', { currencyId: 'syp' })],
			[],
			usdSypRates,
		)

		expect(customer.outstanding).toBeCloseTo(-71.42857143, 5)
		expect(supplier.outstanding).toBeCloseTo(-71.42857143, 5)
	})

	it('uses the stored entry rate when the live rate has changed', () => {
		const liveRates: CostCurrencyRate[] = [
			{ currencyId: 'usd', label: '$', name: 'USD', exchangeRate: 1 },
			{ currencyId: 'syp', label: 'SYP', name: 'ليرة', exchangeRate: 200 },
		]
		const customer = customerPartySummary(
			[],
			[
				entry(DailyActionType.RECEIPT_ENTRY, '12000', {
					currencyId: 'syp',
					exchangeRateToPrimary: 100,
				}),
			],
			[],
			liveRates,
		)

		expect(customer.outstanding).toBeCloseTo(-120, 5)
	})

	it('adds a two-currency opening balance and flips the supplier sign', () => {
		const rows = [
			{
				currencyId: 'usd',
				currencyCode: 'USD',
				amount: 4000,
				direction: 'owed_to_us' as const,
			},
			{
				currencyId: 'syp',
				currencyCode: 'SYP',
				amount: 1200,
				direction: 'we_owe' as const,
			},
		]

		expect(
			customerPartySummary([], [], [], usdSypRates, rows).outstanding,
		).toBeCloseTo(4000 - 1200 / 140, 5)
		expect(
			supplierPartySummary([], [], [], usdSypRates, rows).outstanding,
		).toBeCloseTo(-(4000 - 1200 / 140), 5)
	})

	it('ignores draft invoices and counts a payment stored on the other party id', () => {
		const customer = { customerId: 'c1', internalCode: 'C-1' }
		const actions = [
			entry(DailyActionType.PAYMENT_ENTRY, '15', { supplierId: 'C-1' }),
			entry(DailyActionType.BUYING_ENTRY, '99', { customerId: 'c1' }),
		]

		expect(customerRelatedEntries(actions, customer)).toHaveLength(1)
		expect(
			customerPartySummary(
				[invoice(10, 0, InvoiceStatus.DRAFT)],
				customerRelatedEntries(actions, customer),
				[],
			).outstanding,
		).toBe(15)

		const supplier = { supplierId: 's1' }
		expect(
			supplierRelatedEntries(
				[entry(DailyActionType.RECEIPT_ENTRY, '8', { customerId: 's1' })],
				supplier,
			),
		).toHaveLength(1)
	})
})
