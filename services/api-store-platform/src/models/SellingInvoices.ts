import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ISellingInvoiceItem extends Document {
	tenantId: string
	sellingInvoiceId: string
	customerId?: string
	invoiceNumber: string
	items: Array<{
		productId: string
		name: string
		quantity: number
		unitPrice: number
	}>
	status: 'draft' | 'confirmed' | 'partial' | 'paid' | 'cancelled'
	paymentStatus: 'unpaid' | 'partial' | 'paid'
	paidAmount?: number
	remainingAmount?: number
	totalAmount: number
	totalTax: number
	totalDiscount: number
	totalAmountAfterDiscount: number
	totalAmountAfterTax: number
	totalAmountAfterDiscountAndTax: number
	warehouseId?: string
	notes?: string

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

const SellingInvoiceItemSchema = new Schema<ISellingInvoiceItem>({
	tenantId: { type: String, required: true, index: true },
	sellingInvoiceId: { type: String, required: true, index: true },
	customerId: { type: String },
	invoiceNumber: { type: String, required: true, index: true },
	items: [
		{
			productId: { type: String },
			name: { type: String },
			quantity: { type: Number, min: 1 },
			unitPrice: { type: Number, min: 0 },
		},
	],
	totalAmount: { type: Number, required: true },
	totalTax: { type: Number, required: true },
	totalDiscount: { type: Number, required: true },
	totalAmountAfterDiscount: { type: Number, required: true },
	totalAmountAfterTax: { type: Number, required: true },
	totalAmountAfterDiscountAndTax: { type: Number, required: true },
})

tenantScopedSchema(SellingInvoiceItemSchema)
SellingInvoiceItemSchema.index(
	{ tenantId: 1, sellingInvoiceId: 1 },
	{ unique: true, sparse: true },
)

export const SellingInvoiceItem = mongoose.model<ISellingInvoiceItem>(
	'SellingInvoiceItem',
	SellingInvoiceItemSchema,
)
