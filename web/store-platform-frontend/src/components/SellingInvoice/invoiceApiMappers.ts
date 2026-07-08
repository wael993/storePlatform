import dayjs from 'dayjs'

import {
	calculateInvoiceTotals,
	calculateLineItemTotal,
} from './invoiceCalculations'
import type {
	SellingInvoice,
	SellingInvoiceDraft,
	SellingInvoiceLineItem,
	SellingInvoicePaymentType,
	SellingInvoiceStatus,
	SellingInvoiceSummary,
} from './types'

export interface ApiSellingInvoice {
	invoiceId: string
	invoiceNumber: string
	customerId?: string
	customerName?: string
	salesPerson?: string
	paymentType?: SellingInvoicePaymentType
	items?: Array<{
		productId: string
		name: string
		barcode?: string
		quantity: number
		unit?: string
		unitPrice: number
		discount?: number
		discountIsPercent?: boolean
		taxRate?: number
		lineTotal?: number
	}>
	status?: string
	paymentStatus?: 'unpaid' | 'partial' | 'paid'
	paidAmount?: number
	remainingAmount?: number
	amount?: number
	totalAmount?: number
	totalTax?: number
	totalDiscount?: number
	notes?: string
	issuedAt?: string
	createdAt?: string
}

export interface ApiSellingInvoicesResponse {
	invoices: ApiSellingInvoice[]
	summary: {
		todaySales: number
		paidInvoices: number
		creditInvoices: number
		totalReceivable: number
		averageOrder: number
	}
	nextInvoiceNumber: number
	totalCount: number
}

const mapApiStatusToUi = (invoice: ApiSellingInvoice): SellingInvoiceStatus => {
	if (invoice.status === 'draft') return 'draft'
	if (invoice.status === 'cancelled') return 'cancelled'
	if (invoice.status === 'paid' || invoice.paymentStatus === 'paid')
		return 'paid'
	if (invoice.status === 'partial' || invoice.paymentStatus === 'partial') {
		return 'partial'
	}
	if (
		invoice.paymentType === 'credit' //&& invoice.paymentStatus !== 'paid'
	) {
		return 'credit'
	}
	return 'paid'
}

const formatInvoiceTime = (issuedAt?: string, createdAt?: string) => {
	const source = issuedAt ?? createdAt
	if (!source) return '--:--'

	return dayjs(source).format('hh:mm A')
}

export const mapApiInvoiceToSellingInvoice = (
	invoice: ApiSellingInvoice,
): SellingInvoice => ({
	id: invoice.invoiceId,
	invoiceNumber: Number.parseInt(invoice.invoiceNumber, 10) || 0,
	time: formatInvoiceTime(invoice.issuedAt, invoice.createdAt),
	customerName: invoice.customerName ?? 'Walk-in Customer',
	status: mapApiStatusToUi(invoice),
	paymentType: invoice.paymentType ?? 'cash',
	itemCount: invoice.items?.length ?? 0,
	total: Number(invoice.amount ?? invoice.totalAmount ?? 0),
	paid: Number(invoice.paidAmount ?? 0),
	due: Number(invoice.remainingAmount ?? 0),
})

export const mapApiSummaryToUi = (
	summary: ApiSellingInvoicesResponse['summary'],
): SellingInvoiceSummary => ({
	todaySales: summary.todaySales,
	todaySalesTrend: 0,
	paidInvoices: summary.paidInvoices,
	paidInvoicesTrend: 0,
	creditInvoices: summary.creditInvoices,
	creditInvoicesTrend: 0,
	totalReceivable: summary.totalReceivable,
	averageOrder: summary.averageOrder,
	salesSparkline: [],
})

export const buildInvoiceRequestBody = (
	draft: SellingInvoiceDraft,
	status: 'draft' | 'partial' | 'paid' | 'cancelled' | 'confirmed',
) => {
	const totals = calculateInvoiceTotals(draft.lineItems)
	const paidAmount = draft.paidAmount
	const remainingAmount = Math.max(0, totals.grandTotal - paidAmount)

	let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid'
	if (paidAmount <= 0) paymentStatus = 'unpaid'
	else if (paidAmount + 0.009 >= totals.grandTotal) paymentStatus = 'paid'
	else paymentStatus = 'partial'

	const issuedAt = dayjs(
		`${draft.invoiceDate}T${draft.invoiceTime}`,
	).toISOString()

	return {
		invoiceNumber: String(draft.invoiceNumber),
		customerId: draft.customerId === 'walk-in' ? undefined : draft.customerId,
		customerName: draft.customerName,
		salesPerson: draft.salesPerson,
		paymentType: draft.paymentType,
		items: draft.lineItems.map(item => ({
			productId: item.productId,
			name: item.name,
			barcode: item.barcode,
			quantity: item.quantity,
			unit: item.unit,
			unitPrice: item.unitPrice,
			discount: item.discount,
			discountIsPercent: item.discountIsPercent,
			taxRate: item.taxRate,
			lineTotal: calculateLineItemTotal(item),
		})),
		status,
		paymentStatus,
		paidAmount,
		remainingAmount,
		amount: totals.grandTotal,
		totalAmount: totals.subtotal,
		totalTax: totals.tax,
		totalDiscount: totals.discount,
		notes: draft.note || undefined,
		printAfterPayment: draft.printAfterPayment,
		issuedAt,
	}
}

export const mapInventoryByProductId = (
	inventoryItems: Array<{ productId: string; quantity?: number }>,
) =>
	new Map(
		inventoryItems.map(item => [item.productId, Number(item.quantity ?? 0)]),
	)

export const getAvailableStock = (
	inventoryByProductId: Map<string, number>,
	item: SellingInvoiceLineItem,
) => inventoryByProductId.get(item.productId)
