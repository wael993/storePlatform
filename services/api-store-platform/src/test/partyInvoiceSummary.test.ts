import { describe, expect, it } from 'vitest'

import ProductController from '../apis/api.controller'
import { groupInvoicesByPartyId } from '../apis/mappings/mapper'
import { DailyActionType, InvoiceStatus } from '../shared/globalEnums'
import type { DailyActionResponse } from '../shared/types/api'

const ops = new ProductController({} as never, {} as never)

const entry = (
	entryType: DailyActionType,
	totalPrice: string,
): DailyActionResponse['data'][number] =>
	({ entryType, totalPrice }) as DailyActionResponse['data'][number]

const invoice = (amount: number, paidAmount = 0) => ({
	status: InvoiceStatus.CONFIRMED,
	amount,
	paidAmount,
	remainingAmount: amount - paidAmount,
})

describe('party invoice balances', () => {
	it('adds a payment to what the customer owes and a receipt to what was paid to the supplier', () => {
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
		expect(supplier.totalPayable).toBe(30)
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

	it('groups an invoice under the id stored on it', () => {
		const grouped = groupInvoicesByPartyId(
			[{ customerId: 'sup-1', amount: 10 }, { amount: 5 }, null],
			'customerId',
		)

		expect(grouped.get('sup-1')).toHaveLength(1)
		expect(grouped.has('')).toBe(false)
	})
})
