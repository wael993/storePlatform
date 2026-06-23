import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IStockMoving extends Document {
	tenantId: string
	stockMovingId: string
	productId: string
	warehouseId?: string
	type?:
		| 'purchase'
		| 'sale'
		| 'return_in'
		| 'return_out'
		| 'transfer_in'
		| 'transfer_out'
		| 'adjustment'
	quantity: number
	unitCost: number
	referenceType: string
	referenceId: string
	note?: string
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

const StockMovingSchema: Schema<IStockMoving> = new mongoose.Schema({
	stockMovingId: {
		type: String,
		required: [true, 'stockMovingId is required'],
		unique: true,
		trim: true,
	},
	productId: {
		type: String,
		required: [true, 'productId is required'],
		trim: true,
	},
	warehouseId: {
		type: String,
		trim: true,
	},
	type: {
		type: String,
		enum: [
			'purchase',
			'sale',
			'return_in',
			'return_out',
			'transfer_in',
			'transfer_out',
			'adjustment',
		],
		required: [true, 'type is required'],
	},
	quantity: {
		type: Number,
		required: [true, 'quantity is required'],
		min: 1,
	},
	unitCost: {
		type: Number,
		required: [true, 'unitCost is required'],
		min: 0,
	},
	referenceType: {
		type: String,
		required: [true, 'referenceType is required'],
	},
	referenceId: {
		type: String,
		required: [true, 'referenceId is required'],
		trim: true,
	},
	note: {
		type: String,
		trim: true,
	},
})

tenantScopedSchema(StockMovingSchema)
StockMovingSchema.index({ tenantId: 1, stockMovingId: 1 }, { unique: true })
StockMovingSchema.index({ tenantId: 1, productId: 1 }, { unique: true })

export const StockMoving = mongoose.model<IStockMoving>(
	'StockMovings',
	StockMovingSchema,
)
