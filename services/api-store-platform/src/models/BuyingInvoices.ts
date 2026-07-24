import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IBuyingInvoiceItem {
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

export interface IBuyingInvoiceCurrencyAmount {
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

export interface IBuyingInvoice extends Document {
	tenantId: string
	buyingInvoiceId: string
	invoiceNumber: string
	supplierId?: string
	supplierName?: string
	paymentType?: 'cash' | 'credit'
	items?: IBuyingInvoiceItem[]
	status:
		| 'draft'
		| 'confirmed'
		| 'partial'
		| 'paid'
		| 'cancelled'
		| 'pending'
		| 'void'
	paymentStatus?: 'unpaid' | 'partial' | 'paid'
	currencyAmounts: IBuyingInvoiceCurrencyAmount[]
	notes?: string
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

const BuyingInvoiceItemSchema = new Schema<IBuyingInvoiceItem>(
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

const BuyingInvoiceCurrencyAmountSchema = new Schema<IBuyingInvoiceCurrencyAmount>(
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

const BuyingInvoiceSchema: Schema<IBuyingInvoice> = new mongoose.Schema(
	{
		buyingInvoiceId: {
			type: String,
			required: [true, 'buyingInvoiceId is required'],
			unique: true,
			trim: true,
		},
		invoiceNumber: {
			type: String,
			required: [true, 'invoiceNumber is required'],
			trim: true,
		},
		supplierId: {
			type: String,
			trim: true,
		},
		supplierName: {
			type: String,
			trim: true,
		},
		paymentType: {
			type: String,
			enum: ['cash', 'credit'],
		},
		items: {
			type: [BuyingInvoiceItemSchema],
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
		currencyAmounts: {
			type: [BuyingInvoiceCurrencyAmountSchema],
			required: true,
			validate: {
				validator: (value: IBuyingInvoiceCurrencyAmount[]) => value.length > 0,
				message: 'At least one currency amount is required',
			},
		},
		notes: {
			type: String,
			trim: true,
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

tenantScopedSchema(BuyingInvoiceSchema)
BuyingInvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 })

export const BuyingInvoice = mongoose.model<IBuyingInvoice>(
	'BuyingInvoice',
	BuyingInvoiceSchema,
)
