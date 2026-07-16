import dayjs from 'dayjs'

import { generateId } from '../../offline/utils'
import {
	calculateInvoiceTotals,
	calculateLineItemTotal,
} from './invoiceCalculations'
import {
	buildInvoiceCurrencyAmounts,
	getPrimaryInvoiceCurrencyAmounts,
	type InvoiceCurrencyAmount,
} from './currencyDisplay'
import type { CurrencySettings } from '../../api/apiStore'
import type {
	SellingInvoice,
	SellingInvoiceDraft,
	SellingInvoiceLineItem,
	SellingInvoicePaymentType,
	SellingInvoiceStatus,
	SellingInvoiceSummary,
} from './types'

export type { InvoiceCurrencyAmount }

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
	currencyAmounts?: InvoiceCurrencyAmount[]
	notes?: string
	issuedAt?: string
	createdAt?: string
	/** @deprecated legacy invoices only */
	amount?: number
	/** @deprecated legacy invoices only */
	paidAmount?: number
	/** @deprecated legacy invoices only */
	remainingAmount?: number
	/** @deprecated legacy invoices only */
	totalAmount?: number
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
): SellingInvoice => {
	const { grandTotal, paidAmount, remainingAmount } =
		getPrimaryInvoiceCurrencyAmounts(invoice)

	return {
		id: invoice.invoiceId,
		invoiceNumber: Number.parseInt(invoice.invoiceNumber, 10) || 0,
		time: formatInvoiceTime(invoice.issuedAt, invoice.createdAt),
		customerName: invoice.customerName ?? 'Walk-in Customer',
		status: mapApiStatusToUi(invoice),
		paymentType: invoice.paymentType ?? 'cash',
		itemCount: invoice.items?.length ?? 0,
		total: grandTotal,
		paid: paidAmount,
		due: remainingAmount,
		currencyAmounts: invoice.currencyAmounts,
	}
}

export const mapApiInvoiceToDraft = (
	invoice: ApiSellingInvoice,
	fallbackCustomerName = 'Walk-in Customer',
): SellingInvoiceDraft => {
	const { paidAmount } = getPrimaryInvoiceCurrencyAmounts(invoice)
	const issuedAt = invoice.issuedAt ?? invoice.createdAt

	return {
		invoiceId: invoice.invoiceId,
		invoiceNumber: Number.parseInt(invoice.invoiceNumber, 10) || 0,
		invoiceDate: issuedAt ? dayjs(issuedAt).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
		invoiceTime: issuedAt ? dayjs(issuedAt).format('HH:mm') : dayjs().format('HH:mm'),
		salesPerson: invoice.salesPerson ?? '',
		customerId: invoice.customerId || 'walk-in',
		customerName: invoice.customerName ?? fallbackCustomerName,
		paymentType: invoice.paymentType ?? 'cash',
		lineItems: (invoice.items ?? []).map(item => ({
			id: generateId(),
			productId: item.productId,
			name: item.name,
			barcode: item.barcode,
			quantity: item.quantity,
			unit: item.unit ?? '',
			unitPrice: item.unitPrice,
			discount: item.discount ?? 0,
			discountIsPercent: item.discountIsPercent ?? true,
			taxRate: item.taxRate ?? 0,
		})),
		note: invoice.notes ?? '',
		paidAmount,
	}
}

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
	currencySettings?: CurrencySettings | null,
) => {
	const totals = calculateInvoiceTotals(draft.lineItems)
	const paidAmount = draft.paidAmount
	const remainingAmount = Math.max(0, totals.grandTotal - paidAmount)
	const currencyAmounts = buildInvoiceCurrencyAmounts(
		currencySettings,
		totals,
		paidAmount,
		remainingAmount,
	)

	if (!currencyAmounts.length) {
		throw new Error('Currency settings are required to save an invoice.')
	}

	let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid'
	if (paidAmount <= 0) paymentStatus = 'unpaid'
	else if (paidAmount + 0.009 >= totals.grandTotal) paymentStatus = 'paid'
	else paymentStatus = 'partial'

	const issuedAt = dayjs(
		`${draft.invoiceDate}T${draft.invoiceTime}`,
	).toISOString()

	return {
		invoiceId: draft.invoiceId,
		clientMutationId: generateId(),
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
		currencyAmounts,
		notes: draft.note || undefined,
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
