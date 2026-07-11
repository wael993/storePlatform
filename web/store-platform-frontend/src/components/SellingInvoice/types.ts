export type SellingInvoiceStatus =
	| 'paid'
	| 'credit'
	| 'partial'
	| 'draft'
	| 'cancelled'

export type SellingInvoicePaymentType = 'cash' | 'credit' | 'card'

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
}

export interface SellingInvoiceDraft {
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
	printAfterPayment: boolean
	paidAmount: number
}

export interface InvoiceTotals {
	subtotal: number
	discount: number
	tax: number
	grandTotal: number
}
