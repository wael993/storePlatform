import { describe, expect, it } from 'vitest'

import ProductController from '../apis/api.controller'
import { groupInvoicesByPartyId } from '../apis/mappings/mapper'
import { DailyActionType, InvoiceStatus } from '../shared/globalEnums'
import type { CostCurrencyRate } from '../shared/inventoryCost'
import type { DailyActionResponse } from '../shared/types/api'

const ops = new ProductController({} as never, {} as never)

const entry = (
	entryType: DailyActionType,
	totalPrice: string,
	currencyId?: string,
	exchangeRateToPrimary?: number,
): DailyActionResponse['data'][number] =>
	({
		entryType,
		totalPrice,
		currencyId,
		exchangeRateToPrimary,
	}) as DailyActionResponse['data'][number]

const usdSypRates: CostCurrencyRate[] = [
	{ currencyId: 'usd', label: '$', name: 'USD', exchangeRate: 1 },
	{ currencyId: 'syp', label: 'SYP', name: 'ليرة', exchangeRate: 140 },
]

const invoice = (amount: number, paidAmount = 0) => ({
	status: InvoiceStatus.CONFIRMED,
	amount,
	paidAmount,
	remainingAmount: amount - paidAmount,
})

describe('party invoice balances', () => {
	it('adds a customer payment and a supplier receipt, and subtracts a customer receipt and a supplier payment', () => {
		const customer = ops.buildCustomerInvoiceSummary(
			[invoice(100)],
			[
				entry(DailyActionType.PAYMENT_ENTRY, '25'),
				entry(DailyActionType.RECEIPT_ENTRY, '10'),
			],
		)
		const supplier = ops.buildSupplierInvoiceSummary(
			[invoice(80)],
			[
				entry(DailyActionType.PAYMENT_ENTRY, '20'),
				entry(DailyActionType.RECEIPT_ENTRY, '30'),
			],
		)

		expect(customer.totalReceivable).toBe(115)
		expect(supplier.totalPayable).toBe(90)
	})

	it('nets a purchase against customer receivable and a sale against supplier payable', () => {
		const customer = ops.buildCustomerInvoiceSummary([invoice(100)], [])
		const purchase = ops.buildCustomerInvoiceSummary([invoice(40)], [])
		const supplier = ops.buildSupplierInvoiceSummary([invoice(80)], [])
		const sale = ops.buildSupplierInvoiceSummary([invoice(50, 10)], [])

		expect(
			customer.totalReceivable - (purchase.totalInvoiced - purchase.totalPaid),
		).toBe(60)

		expect(supplier.totalPayable - (sale.totalInvoiced - sale.totalPaid)).toBe(
			40,
		)
	})

	it('keeps a supplier overpayment as money owed to us', () => {
		const supplier = ops.buildSupplierInvoiceSummary(
			[invoice(40)],
			[entry(DailyActionType.PAYMENT_ENTRY, '100')],
		)

		expect(supplier.totalPayable).toBe(-60)
	})

	it('converts a 10000 SYR payment or receipt into primary dollars', () => {
		const customer = ops.buildCustomerInvoiceSummary(
			[],
			[entry(DailyActionType.RECEIPT_ENTRY, '10000', 'syp')],
			usdSypRates,
		)
		const supplier = ops.buildSupplierInvoiceSummary(
			[],
			[entry(DailyActionType.PAYMENT_ENTRY, '10000', 'syp')],
			usdSypRates,
		)

		expect(customer.totalReceivable).toBeCloseTo(-71.42857143, 5)
		expect(supplier.totalPayable).toBeCloseTo(-71.42857143, 5)
	})

	it('keeps an invoice payment in the invoice and does not post it again', () => {
		const customer = ops.buildCustomerInvoiceSummary([invoice(37, 37)], [])

		expect(customer.totalReceivable).toBe(0)
		expect(customer.totalPaid).toBe(37)
	})

	it('uses the stored entry rate when the live rate has changed', () => {
		const liveRates: CostCurrencyRate[] = [
			{ currencyId: 'usd', label: '$', name: 'USD', exchangeRate: 1 },
			{ currencyId: 'syp', label: 'SYP', name: 'ليرة', exchangeRate: 200 },
		]
		const customer = ops.buildCustomerInvoiceSummary(
			[],
			[entry(DailyActionType.RECEIPT_ENTRY, '12000', 'syp', 100)],
			liveRates,
		)

		expect(customer.totalReceivable).toBeCloseTo(-120, 5)
	})

	it('groups an invoice under the id stored on it', () => {
		const grouped = groupInvoicesByPartyId(
			[{ customerId: 'sup-1', amount: 10 }, { amount: 5 }, null],
			'customerId',
		)

		expect(grouped.get('sup-1')).toHaveLength(1)
		expect(grouped.has('')).toBe(false)
	})
})
