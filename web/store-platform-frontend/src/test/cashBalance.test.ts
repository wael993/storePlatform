import { describe, expect, it } from 'vitest'

import {
	DailyActionType,
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
} from '../shared/globalEnums'
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
					{ createdAt: 'not-a-date' } as ApiSellingInvoice,
					{} as ApiSellingInvoice,
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

	it('adds in-range cash sales and subtracts cash purchases', () => {
		expect(
			calculateCashBalance({
				dailyActions: [],
				sellingInvoices: [
					{
						issuedAt: '2026-07-01',
						status: InvoiceStatus.PAID,
						paymentType: InvoicePaymentType.CASH,
						amount: 50,
					} as ApiSellingInvoice,
					{
						issuedAt: '2026-07-01',
						status: InvoiceStatus.PARTIAL,
						paymentType: InvoicePaymentType.CARD,
						amount: 40,
						paidAmount: 10,
					} as ApiSellingInvoice,
					{
						issuedAt: '2026-07-01',
						paymentStatus: InvoicePaymentStatus.PARTIAL,
						paymentType: InvoicePaymentType.CASH,
						amount: 40,
						paidAmount: 8,
					} as ApiSellingInvoice,
				],
				buyingInvoices: [
					{
						buyingInvoiceId: 'b1',
						invoiceNumber: '1',
						issuedAt: '2026-07-01',
						status: InvoiceStatus.CONFIRMED,
						paymentType: InvoicePaymentType.CASH,
						amount: 20,
					} as ApiBuyingInvoice,
				],
				range,
				displayCurrencyOptions: primaryOptions,
			}),
		).toBe(48)
	})

	it('ignores credit, drafts, zero totals, and non-cash purchases', () => {
		const expense: DailyAction = {
			actionId: 'e1',
			entryType: DailyActionType.EXPENSE_ENTRY,
			currencyId: 'primary',
			currencyName: 'SYP',
			invoiceDate: '2026-07-01',
			totalPrice: '15',
		}
		const other: DailyAction = {
			actionId: 'o1',
			entryType: DailyActionType.SELLING_ENTRY,
			currencyId: 'primary',
			currencyName: 'SYP',
			invoiceDate: '2026-07-01',
			singleUnitPrice: 'nope',
		}

		expect(
			calculateCashBalance({
				dailyActions: [expense, other],
				sellingInvoices: [
					{
						issuedAt: '2026-07-01',
						status: InvoiceStatus.DRAFT,
						paymentType: InvoicePaymentType.CASH,
						amount: 50,
					} as ApiSellingInvoice,
					{
						issuedAt: '2026-07-01',
						status: InvoiceStatus.PAID,
						paymentType: InvoicePaymentType.CREDIT,
						amount: 50,
					} as ApiSellingInvoice,
					{
						issuedAt: '2026-07-01',
						paymentStatus: InvoicePaymentStatus.PAID,
						paymentType: InvoicePaymentType.CASH,
						amount: 0,
					} as ApiSellingInvoice,
				],
				buyingInvoices: [
					{
						buyingInvoiceId: 'b2',
						invoiceNumber: '2',
						issuedAt: '2026-07-01',
						status: InvoiceStatus.PAID,
						paymentType: InvoicePaymentType.CARD,
						amount: 20,
					} as unknown as ApiBuyingInvoice,
					{
						buyingInvoiceId: 'b3',
						invoiceNumber: '3',
						issuedAt: '2026-07-01',
						status: InvoiceStatus.PAID,
						paymentType: InvoicePaymentType.CREDIT,
						amount: 20,
					} as ApiBuyingInvoice,
				],
				range,
				displayCurrencyOptions: primaryOptions,
			}),
		).toBe(-15)
	})

	it('treats a missing amount as zero and a missing payment type as cash', () => {
		const emptyReceipt: DailyAction = {
			actionId: 'z1',
			entryType: DailyActionType.RECEIPT_ENTRY,
			currencyId: 'primary',
			currencyName: 'SYP',
			invoiceDate: '2026-07-01',
		}

		expect(
			calculateCashBalance({
				dailyActions: [emptyReceipt],
				sellingInvoices: [
					{
						issuedAt: '2026-07-01',
						status: InvoiceStatus.PAID,
						paymentType: 'bank',
						amount: 50,
					} as unknown as ApiSellingInvoice,
					{
						issuedAt: '2026-07-01',
						status: InvoiceStatus.PAID,
						amount: 7,
					} as ApiSellingInvoice,
				],
				buyingInvoices: [
					{
						buyingInvoiceId: 'b4',
						invoiceNumber: '4',
						issuedAt: '2026-07-01',
						status: InvoiceStatus.DRAFT,
						paymentType: InvoicePaymentType.CASH,
						amount: 20,
					} as ApiBuyingInvoice,
					{
						buyingInvoiceId: 'b5',
						invoiceNumber: '5',
						issuedAt: '2026-07-01',
						status: InvoiceStatus.PAID,
						amount: 3,
					} as ApiBuyingInvoice,
					{
						buyingInvoiceId: 'b6',
						invoiceNumber: '6',
						issuedAt: '2026-07-01',
						status: InvoiceStatus.PAID,
						paymentType: InvoicePaymentType.CASH,
						amount: 0,
					} as ApiBuyingInvoice,
				],
				range,
				displayCurrencyOptions: primaryOptions,
			}),
		).toBe(4)
	})

	it('excludes cancelled invoices and drafts even when payment status is paid', () => {
		expect(
			calculateCashBalance({
				dailyActions: [],
				sellingInvoices: [
					{
						issuedAt: '2026-07-01',
						status: InvoiceStatus.CANCELLED,
						paymentType: InvoicePaymentType.CASH,
						amount: 50,
					} as ApiSellingInvoice,
					{
						issuedAt: '2026-07-01',
						status: InvoiceStatus.DRAFT,
						paymentStatus: InvoicePaymentStatus.PAID,
						paymentType: InvoicePaymentType.CASH,
						amount: 50,
					} as ApiSellingInvoice,
				],
				buyingInvoices: [
					{
						buyingInvoiceId: 'b7',
						invoiceNumber: '7',
						issuedAt: '2026-07-01',
						status: InvoiceStatus.CANCELLED,
						paymentType: InvoicePaymentType.CASH,
						amount: 20,
					} as ApiBuyingInvoice,
				],
				range,
				displayCurrencyOptions: primaryOptions,
			}),
		).toBe(0)
	})

	it('uses createdAt, comma amounts, buying partial, and daily actions outside the invoice range', () => {
		const juneReceipt: DailyAction = {
			...receipt,
			actionId: 'r-june',
			invoiceDate: '2026-06-01',
			singleUnitPrice: '1,000',
		}

		expect(
			calculateCashBalance({
				dailyActions: [juneReceipt],
				sellingInvoices: [
					{
						createdAt: '2026-07-01',
						status: InvoiceStatus.PAID,
						paymentType: InvoicePaymentType.CASH,
						amount: 5,
					} as ApiSellingInvoice,
				],
				buyingInvoices: [
					{
						buyingInvoiceId: 'b8',
						invoiceNumber: '8',
						issuedAt: '2026-07-01',
						status: InvoiceStatus.PARTIAL,
						paymentType: InvoicePaymentType.CASH,
						amount: 40,
						paidAmount: 12,
					} as ApiBuyingInvoice,
				],
				range,
				displayCurrencyOptions: primaryOptions,
			}),
		).toBe(993)
	})

	it('includes invoices when the date range has no bounds', () => {
		expect(
			calculateCashBalance({
				dailyActions: [],
				sellingInvoices: [
					{
						issuedAt: '2020-01-01',
						status: InvoiceStatus.PAID,
						paymentType: InvoicePaymentType.CASH,
						amount: 9,
					} as ApiSellingInvoice,
				],
				buyingInvoices: [],
				range: {},
				displayCurrencyOptions: primaryOptions,
			}),
		).toBe(9)
	})
})
