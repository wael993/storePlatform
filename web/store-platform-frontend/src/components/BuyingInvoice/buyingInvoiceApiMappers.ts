import dayjs from 'dayjs'

import { generateId } from '../../offline/utils'
import {
	calculateInvoiceTotals,
	calculateLineItemTotal,
} from '../SellingInvoice/invoiceCalculations'
import {
	buildInvoiceCurrencyAmounts,
	type InvoiceCurrencyAmount,
} from '../SellingInvoice/currencyDisplay'
import type { CurrencySettings } from '../../api/apiStore'
import type { BuyingInvoiceDraft } from './types'

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
}

export const buildBuyingInvoiceRequestBody = (
	draft: BuyingInvoiceDraft,
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
		throw new Error('Currency settings are required to save a buying invoice.')
	}

	let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid'
	if (paidAmount <= 0) paymentStatus = 'unpaid'
	else if (paidAmount + 0.009 >= totals.grandTotal) paymentStatus = 'paid'
	else paymentStatus = 'partial'

	const issuedAt = dayjs(
		`${draft.invoiceDate}T${draft.invoiceTime}`,
	).toISOString()

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
	}
}
