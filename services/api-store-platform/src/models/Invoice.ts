import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'
import {
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
} from '../shared/globalEnums'

export interface IInvoiceItem {
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
}

export interface IInvoiceCurrencyAmount {
	currencyId: string
	name: string
	internalCode?: string
	exchangeRate: number
	isPrimary: boolean
	amount: number
	paidAmount: number
	remainingAmount: number
	subtotal: number
	tax: number
	discount: number
}

export interface IInvoice extends Document {
	tenantId: string
	invoiceId: string
	invoiceNumber: string
	orderId?: string
	customerId?: string
	customerName?: string
	salesPerson?: string
	paymentType?: `${InvoicePaymentType}`
	items?: IInvoiceItem[]
	status: `${InvoiceStatus}`
	paymentStatus?: `${InvoicePaymentStatus}`
	currencyAmounts: IInvoiceCurrencyAmount[]
	notes?: string
	invoiceDiscount?: number
	invoiceDiscountIsPercent?: boolean
	printAfterPayment?: boolean
	warehouseId?: string
	issuedAt: Date
	createdBy: {
		_id: string
		displayName: string
		role?: string
		createdAt: Date
	}
	updatedBy?: {
		_id: string
		displayName: string
		role?: string
		updatedAt: Date
	}
}

const InvoiceItemSchema = new Schema<IInvoiceItem>(
	{
		productId: { type: String, required: true, trim: true },
		name: { type: String, required: true, trim: true },
		barcode: { type: String, trim: true },
		quantity: { type: Number, required: true, min: 1 },
		unit: { type: String, trim: true },
		unitPrice: { type: Number, required: true, min: 0 },
		discount: { type: Number, min: 0, default: 0 },
		discountIsPercent: { type: Boolean, default: true },
		taxRate: { type: Number, min: 0, default: 0 },
		lineTotal: { type: Number, min: 0 },
	},
	{ _id: false },
)

const InvoiceCurrencyAmountSchema = new Schema<IInvoiceCurrencyAmount>(
	{
		currencyId: { type: String, required: true, trim: true },
		name: { type: String, required: true, trim: true },
		internalCode: { type: String, trim: true, uppercase: true },
		exchangeRate: { type: Number, required: true, min: 0 },
		isPrimary: { type: Boolean, default: false },
		amount: { type: Number, required: true, min: 0 },
		paidAmount: { type: Number, required: true, min: 0 },
		remainingAmount: { type: Number, required: true, min: 0 },
		subtotal: { type: Number, required: true, min: 0 },
		tax: { type: Number, required: true, min: 0 },
		discount: { type: Number, required: true, min: 0 },
	},
	{ _id: false },
)

const InvoiceSchema: Schema<IInvoice> = new mongoose.Schema(
	{
		invoiceId: {
			type: String,
			required: [true, 'invoiceId is required'],
			unique: true,
			trim: true,
		},
		invoiceNumber: {
			type: String,
			required: [true, 'invoiceNumber is required'],
			trim: true,
		},
		orderId: {
			type: String,
			trim: true,
		},
		customerId: {
			type: String,
			trim: true,
		},
		customerName: {
			type: String,
			trim: true,
		},
		salesPerson: {
			type: String,
			trim: true,
		},
		paymentType: {
			type: String,
			enum: Object.values(InvoicePaymentType),
		},
		items: {
			type: [InvoiceItemSchema],
			default: [],
		},
		status: {
			type: String,
			enum: Object.values(InvoiceStatus),
			default: InvoiceStatus.DRAFT,
		},
		paymentStatus: {
			type: String,
			enum: Object.values(InvoicePaymentStatus),
			default: InvoicePaymentStatus.UNPAID,
		},
		currencyAmounts: {
			type: [InvoiceCurrencyAmountSchema],
			required: true,
			validate: {
				validator: (value: IInvoiceCurrencyAmount[]) => value.length > 0,
				message: 'At least one currency amount is required',
			},
		},
		notes: {
			type: String,
			trim: true,
		},
		invoiceDiscount: {
			type: Number,
			min: 0,
			default: 0,
		},
		invoiceDiscountIsPercent: {
			type: Boolean,
			default: false,
		},
		printAfterPayment: {
			type: Boolean,
			default: false,
		},
		warehouseId: {
			type: String,
			trim: true,
		},
		issuedAt: {
			type: Date,
			required: true,
		},
	},
	{ timestamps: true },
)

tenantScopedSchema(InvoiceSchema)
InvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 })

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema)
