import type { ResolvedInvoiceBrand } from './invoicePdfBrand'
import type { SellingInvoiceStatus } from './types'

export interface InvoiceDocumentLine {
	name: string
	quantity: number
	unit: string
	unitPrice: number
	discountLabel: string
	lineTotal: number
}

export interface InvoiceDocumentLabels {
	invoiceTitle: string
	buyingInvoiceTitle: string
	billTo: string
	supplier: string
	invoiceNumber: string
	date: string
	time: string
	status: string
	paymentType: string
	salesPerson: string
	item: string
	qty: string
	unit: string
	unitPrice: string
	discount: string
	lineTotal: string
	subtotal: string
	invoiceDiscount: string
	tax: string
	grandTotal: string
	paid: string
	due: string
	notes: string
	phone: string
	email: string
	taxNumber: string
	address: string
}

export interface InvoiceDocumentModel {
	kind: 'selling' | 'buying'
	brand: ResolvedInvoiceBrand
	invoiceNumber: string
	invoiceDate: string
	invoiceTime: string
	status: SellingInvoiceStatus
	statusLabel: string
	paymentTypeLabel: string
	partyName: string
	salesPerson?: string
	currencyLabel: string
	lines: InvoiceDocumentLine[]
	subtotal: number
	discount: number
	tax: number
	grandTotal: number
	paid: number
	due: number
	notes?: string
	labels: InvoiceDocumentLabels
	formatAmount: (amount: number) => string
}
