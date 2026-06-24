import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IInventory extends Document {
	tenantId: string
	inventoryId: string
	productId: string
	warehouseId?: string
	shelfId?: string
	quantity?: number
	averageCost?: number
	minQuantity?: number // low stock alert
	maxQuantity?: number // overstock alert
	reservedQuantity?: number // reserved for pending orders
	availableQuantity?: number // quantity - reserved
	lastCountDate?: Date
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

const InventorySchema: Schema<IInventory> = new mongoose.Schema(
	{
		inventoryId: {
			type: String,
			required: [true, 'inventoryId is required'],
			unique: true,
			trim: true,
			index: true,
		},
		productId: {
			type: String,
			required: [true, 'productId is required'],
			trim: true,
		},
		warehouseId: {
			type: String,
		},
		shelfId: {
			type: String,
		},
		quantity: {
			type: Number,
		},
		averageCost: {
			type: Number,
		},
		minQuantity: {
			type: Number,
		},
		maxQuantity: {
			type: Number,
		},
		reservedQuantity: {
			type: Number,
		},
		availableQuantity: {
			type: Number,
		},
		lastCountDate: {
			type: Date,
		},
	},
	{ timestamps: true },
)

tenantScopedSchema(InventorySchema)

InventorySchema.index(
	{ tenantId: 1, productId: 1 },
	{ unique: true, sparse: true },
)

export const Inventory = mongoose.model<IInventory>(
	'Inventory',
	InventorySchema,
)
