import type { InvoiceCurrencyAmount } from './currencyDisplay'
import type {
	InvoicePaymentType,
	InvoiceUiStatus,
} from '../../shared/globalEnums'

export type SellingInvoiceStatus = `${InvoiceUiStatus}`

export type SellingInvoicePaymentType = `${InvoicePaymentType}`

export interface SellingInvoice {
	id: string
	invoiceNumber: number
	time: string
	customerName: string
	status: SellingInvoiceStatus
	paymentType: SellingInvoicePaymentType
	itemCount: number
	total: number
	paid: number
	due: number
	currencyAmounts?: InvoiceCurrencyAmount[]
}

export interface SellingInvoiceSummary {
	todaySales: number
	todaySalesTrend: number
	paidInvoices: number
	paidInvoicesTrend: number
	creditInvoices: number
	creditInvoicesTrend: number
	totalReceivable: number
	averageOrder: number
	totalProfit: number
	bestSeller: {
		productId: string
		productName: string
		quantity: number
	} | null
	topProfitProduct: {
		productId: string
		productName: string
		profit: number
	} | null
	salesSparkline: number[]
}

export type SellingInvoiceStatusFilter = 'all' | SellingInvoiceStatus

export type SellingInvoiceSortKey = 'invoiceNumber' | 'time'
export type SortDirection = 'asc' | 'desc'

export interface SellingInvoiceLineItem {
	id: string
	productId: string
	name: string
	modelCode?: string
	barcode?: string
	imageUrl?: string
	quantity: number
	unit: string
	unitPrice: number
	discount: number
	discountIsPercent: boolean
	taxRate: number
	/** Cost reference snapshotted from the product at add-time, shown in the unit price tooltip. */
	averageCost?: number
	lastBuyingPrice?: number
	lastSellingPrice?: number
	/** Original name printed on the supplier invoice, when this line came from extraction. */
	sourceName?: string
}

export interface InvoiceDiscountDraftFields {
	useInvoiceDiscount: boolean
	invoiceDiscount: number
	invoiceDiscountIsPercent: boolean
}

export interface SellingInvoiceDraft extends InvoiceDiscountDraftFields {
	invoiceId: string
	invoiceNumber: number
	invoiceDate: string
	invoiceTime: string
	salesPerson: string
	customerId: string
	customerName: string
	paymentType: SellingInvoicePaymentType
	lineItems: SellingInvoiceLineItem[]
	note: string
	paidAmount: number
}

export interface InvoiceTotals {
	subtotal: number
	discount: number
	tax: number
	grandTotal: number
}

export type { InvoiceCurrencyAmount }
