import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IOrder extends Document {
	tenantId: string
	orderId: string
	orderNumber: string
	status: 'draft' | 'open' | 'paid' | 'cancelled'
	items: Array<{
		productId: string
		name: string
		quantity: number
		unitPrice: number
	}>
	totalAmount: number
	createdBy: string
	updatedBy?: string
	createdAt: Date
	updatedAt: Date
}

const OrderSchema: Schema<IOrder> = new mongoose.Schema(
	{
		orderId: {
			type: String,
			required: [true, 'orderId is required'],
			unique: true,
			trim: true,
		},
		orderNumber: {
			type: String,
			required: [true, 'orderNumber is required'],
			trim: true,
		},
		status: {
			type: String,
			enum: ['draft', 'open', 'paid', 'cancelled'],
			default: 'draft',
		},
		items: [
			{
				productId: { type: String, required: true, trim: true },
				name: { type: String, required: true, trim: true },
				quantity: { type: Number, required: true, min: 1 },
				unitPrice: { type: Number, required: true, min: 0 },
			},
		],
		totalAmount: {
			type: Number,
			required: true,
			min: 0,
		},
		createdBy: {
			type: String,
			required: true,
			trim: true,
		},
		updatedBy: {
			type: String,
			trim: true,
		},
	},
	{ timestamps: true },
)

tenantScopedSchema(OrderSchema)

export const Order = mongoose.model<IOrder>('Order', OrderSchema)
