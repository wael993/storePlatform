import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IBuyingInvoiceItem extends Document {
	tenantId: string
	buyingInvoiceId: string
	supplierId?: string
	invoiceNumber: string
	items: Array<{
		productId: string
		quantity: number
		unitPrice: number
	}>
	totalAmount: number
	totalTax: number
	totalDiscount: number
	totalAmountAfterDiscount: number
	totalAmountAfterTax: number
	totalAmountAfterDiscountAndTax: number
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

const BuyingInvoiceItemSchema = new Schema<IBuyingInvoiceItem>({
	tenantId: { type: String, required: true, index: true },
	buyingInvoiceId: { type: String, required: true, index: true },
	supplierId: { type: String },
	invoiceNumber: { type: String, required: true, index: true },
	items: [
		{
			productId: { type: String },
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

tenantScopedSchema(BuyingInvoiceItemSchema)
BuyingInvoiceItemSchema.index(
	{ tenantId: 1, internalCode: 1 },
	{ unique: true, sparse: true },
)

export const BuyingInvoiceItem = mongoose.model<IBuyingInvoiceItem>(
	'BuyingInvoiceItem',
	BuyingInvoiceItemSchema,
)
