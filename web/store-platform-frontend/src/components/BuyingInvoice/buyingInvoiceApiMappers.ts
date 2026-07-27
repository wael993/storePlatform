import dayjs from 'dayjs'

import { generateId } from '../../offline/utils'
import {
	calculateInvoiceTotals,
	calculateLineItemTotal,
} from '../SellingInvoice/invoiceCalculations'
import { getInvoiceDiscountSettings } from '../SellingInvoice/invoiceDiscountDraft'
import {
	buildInvoiceCurrencyAmounts,
	getPrimaryInvoiceCurrencyAmounts,
	type InvoiceCurrencyAmount,
} from '../SellingInvoice/currencyDisplay'
import type {
	SellingInvoice,
	SellingInvoicePaymentType,
	SellingInvoiceStatus,
} from '../SellingInvoice/types'
import type { BuyingInvoiceDraft } from './types'
import type { CurrencySettings } from '../../api/apiStore'
import { parseInvoiceSequence } from '../../shared/invoiceNumbering'
import { buildInvoiceIssuedAtIso } from '../../shared/dateUtils'

export type { InvoiceCurrencyAmount }

export interface ApiBuyingInvoice {
	buyingInvoiceId: string
	invoiceNumber: string
	supplierId?: string
	supplierName?: string
	paymentType?: 'cash' | 'credit'
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
	invoiceDiscount?: number
	invoiceDiscountIsPercent?: boolean
}

const mapApiBuyingStatusToUi = (
	invoice: ApiBuyingInvoice,
): SellingInvoiceStatus => {
	if (invoice.status === 'draft') return 'draft'
	if (invoice.status === 'cancelled') return 'cancelled'
	if (invoice.status === 'paid' || invoice.paymentStatus === 'paid')
		return 'paid'
	if (invoice.status === 'partial' || invoice.paymentStatus === 'partial') {
		return 'partial'
	}
	if (invoice.paymentType === 'credit') return 'credit'
	return 'paid'
}

const formatInvoiceTime = (issuedAt?: string, createdAt?: string) => {
	const source = issuedAt ?? createdAt
	if (!source) return '--:--'

	return dayjs(source).format('hh:mm A')
}

export const mapApiBuyingInvoiceToTableRow = (
	invoice: ApiBuyingInvoice,
): SellingInvoice => {
	const { grandTotal, paidAmount, remainingAmount } =
		getPrimaryInvoiceCurrencyAmounts(invoice)

	return {
		id: invoice.buyingInvoiceId,
		invoiceNumber: parseInvoiceSequence(invoice.invoiceNumber),
		time: formatInvoiceTime(invoice.issuedAt, invoice.createdAt),
		customerName: invoice.supplierName ?? '—',
		status: mapApiBuyingStatusToUi(invoice),
		paymentType: (invoice.paymentType ?? 'cash') as SellingInvoicePaymentType,
		itemCount: invoice.items?.length ?? 0,
		total: grandTotal,
		paid: paidAmount,
		due: remainingAmount,
		currencyAmounts: invoice.currencyAmounts,
	}
}

export const mapApiBuyingInvoiceToDraft = (
	invoice: ApiBuyingInvoice,
): BuyingInvoiceDraft => {
	const { paidAmount } = getPrimaryInvoiceCurrencyAmounts(invoice)
	const issuedAt = invoice.issuedAt ?? invoice.createdAt

	return {
		invoiceId: invoice.buyingInvoiceId,
		invoiceNumber: parseInvoiceSequence(invoice.invoiceNumber),
		invoiceDate: issuedAt
			? dayjs(issuedAt).format('YYYY-MM-DD')
			: dayjs().format('YYYY-MM-DD'),
		invoiceTime: issuedAt
			? dayjs(issuedAt).format('HH:mm')
			: dayjs().format('HH:mm'),
		salesPerson: '',
		supplierId: invoice.supplierId ?? '',
		supplierName: invoice.supplierName ?? '—',
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
		useInvoiceDiscount: (invoice.invoiceDiscount ?? 0) > 0,
		invoiceDiscount: invoice.invoiceDiscount ?? 0,
		invoiceDiscountIsPercent: invoice.invoiceDiscountIsPercent ?? false,
	}
}

export const buildBuyingInvoiceRequestBody = (
	draft: BuyingInvoiceDraft,
	status: 'draft' | 'partial' | 'paid' | 'cancelled' | 'confirmed',
	currencySettings?: CurrencySettings | null,
) => {
	const totals = calculateInvoiceTotals(
		draft.lineItems,
		getInvoiceDiscountSettings(draft),
	)
	const paidAmount = draft.paidAmount
	const remainingAmount = Math.max(0, totals.grandTotal - paidAmount)
	const currencyAmounts = buildInvoiceCurrencyAmounts(
		currencySettings,
		totals,
		paidAmount,
		remainingAmount,
	)

	if (!currencyAmounts.length) {
		throw new Error('Currency settings are required to save a buying invoice.')
	}

	let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid'
	if (paidAmount <= 0) paymentStatus = 'unpaid'
	else if (paidAmount + 0.009 >= totals.grandTotal) paymentStatus = 'paid'
	else paymentStatus = 'partial'

	const issuedAt = buildInvoiceIssuedAtIso(draft.invoiceDate, draft.invoiceTime)

	return {
		buyingInvoiceId: draft.invoiceId,
		clientMutationId: generateId(),
		// Server allocates BI-000001; draft number is display-only preview.
		supplierId: draft.supplierId || undefined,
		supplierName: draft.supplierName,
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
		invoiceDiscount: draft.useInvoiceDiscount ? draft.invoiceDiscount : 0,
		invoiceDiscountIsPercent: draft.useInvoiceDiscount
			? draft.invoiceDiscountIsPercent
			: false,
	}
}
