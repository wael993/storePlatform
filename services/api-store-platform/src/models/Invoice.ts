import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

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

export interface IInvoice extends Document {
	tenantId: string
	invoiceId: string
	invoiceNumber: string
	orderId?: string
	customerId?: string
	customerName?: string
	salesPerson?: string
	paymentType?: 'cash' | 'card' | 'credit'
	items?: IInvoiceItem[]
	status:
		| 'draft'
		| 'confirmed'
		| 'partial'
		| 'paid'
		| 'cancelled'
		| 'pending'
		| 'void'
	paymentStatus?: 'unpaid' | 'partial' | 'paid'
	paidAmount?: number
	remainingAmount?: number
	amount: number
	totalAmount?: number
	totalTax?: number
	totalDiscount?: number
	notes?: string
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
			enum: ['cash', 'card', 'credit'],
		},
		items: {
			type: [InvoiceItemSchema],
			default: [],
		},
		status: {
			type: String,
			enum: [
				'draft',
				'confirmed',
				'partial',
				'paid',
				'cancelled',
				'pending',
				'void',
			],
			default: 'draft',
		},
		paymentStatus: {
			type: String,
			enum: ['unpaid', 'partial', 'paid'],
			default: 'unpaid',
		},
		paidAmount: {
			type: Number,
			min: 0,
			default: 0,
		},
		remainingAmount: {
			type: Number,
			min: 0,
			default: 0,
		},
		amount: {
			type: Number,
			required: true,
			min: 0,
		},
		totalAmount: {
			type: Number,
			min: 0,
		},
		totalTax: {
			type: Number,
			min: 0,
		},
		totalDiscount: {
			type: Number,
			min: 0,
		},
		notes: {
			type: String,
			trim: true,
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
