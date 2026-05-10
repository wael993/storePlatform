import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IInventory extends Document {
	tenantId: string
	inventoryId: string
	productId: string
	onHand: number
	reserved: number
	reorderLevel: number
	createdBy: string
	updatedBy?: string
	createdAt: Date
	updatedAt: Date
}

const InventorySchema: Schema<IInventory> = new mongoose.Schema(
	{
		inventoryId: {
			type: String,
			required: [true, 'inventoryId is required'],
			unique: true,
			trim: true,
		},
		productId: {
			type: String,
			required: [true, 'productId is required'],
			trim: true,
		},
		onHand: {
			type: Number,
			required: true,
			min: 0,
		},
		reserved: {
			type: Number,
			required: true,
			min: 0,
			default: 0,
		},
		reorderLevel: {
			type: Number,
			required: true,
			min: 0,
			default: 0,
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

tenantScopedSchema(InventorySchema)

export const Inventory = mongoose.model<IInventory>(
	'Inventory',
	InventorySchema,
)
