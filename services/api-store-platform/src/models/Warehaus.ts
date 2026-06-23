import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IWarehouse extends Document {
	tenantId: string
	warehouseId: string
	name: string
	code?: string
	address?: string
	status?: 'active' | 'inactive'
	description?: string
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

const WarehouseSchema: Schema<IWarehouse> = new mongoose.Schema({
	warehouseId: {
		type: String,
		required: [true, 'warehouseId is required'],
		unique: true,
		trim: true,
	},
	name: {
		type: String,
		required: [true, 'name is required'],
		trim: true,
	},
	code: {
		type: String,
		trim: true,
	},
	address: {
		type: String,
		trim: true,
	},
	status: {
		type: String,
		enum: ['active', 'inactive'],
		default: 'active',
	},
	description: {
		type: String,
		trim: true,
	},
})

tenantScopedSchema(WarehouseSchema)

WarehouseSchema.index({ tenantId: 1, warehouseId: 1 }, { unique: true })

export const Warehouse = mongoose.model<IWarehouse>(
	'Warehouses',
	WarehouseSchema,
)
