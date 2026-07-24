import type {
	InvoiceCurrencyAmount,
	InvoiceTotals,
	SellingInvoiceLineItem,
} from '../SellingInvoice/types'

export type BuyingInvoiceStatus = 'paid' | 'credit' | 'partial' | 'draft' | 'cancelled'

export type BuyingInvoicePaymentType = 'cash' | 'credit'

/** Line items share the exact same shape as selling invoices (product/qty/price/discount/tax). */
export type BuyingInvoiceLineItem = SellingInvoiceLineItem

export interface BuyingInvoiceDraft {
	invoiceId: string
	invoiceNumber: number
	invoiceDate: string
	invoiceTime: string
	supplierId: string
	supplierName: string
	paymentType: BuyingInvoicePaymentType
	lineItems: BuyingInvoiceLineItem[]
	note: string
	paidAmount: number
}

export type { InvoiceCurrencyAmount, InvoiceTotals }
