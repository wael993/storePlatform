import type {
	InvoiceCurrencyAmount,
	InvoiceDiscountDraftFields,
	InvoiceTotals,
	SellingInvoiceLineItem,
} from '../SellingInvoice/types'
import type { InvoicePaymentType } from '../../shared/globalEnums'
import type { InvoiceExtractionReview } from '../../shared/invoiceExtraction'

export type BuyingInvoicePaymentType =
	`${InvoicePaymentType.CASH}` | `${InvoicePaymentType.CREDIT}`

/** Line items share the exact same shape as selling invoices (product/qty/price/discount/tax). */
export type BuyingInvoiceLineItem = SellingInvoiceLineItem

export interface BuyingInvoiceDraft extends InvoiceDiscountDraftFields {
	invoiceId: string
	invoiceNumber: number
	invoiceDate: string
	invoiceTime: string
	salesPerson: string
	supplierId: string
	supplierName: string
	paymentType: BuyingInvoicePaymentType
	lineItems: BuyingInvoiceLineItem[]
	note: string
	paidAmount: number
	supplierInvoiceNumber?: string
	/** Original supplier name printed on the invoice, when this draft came from extraction. */
	sourceSupplierName?: string
	extraction?: InvoiceExtractionReview | null
}

export type { InvoiceCurrencyAmount, InvoiceTotals }
