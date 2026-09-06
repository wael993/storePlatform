import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IBrand extends Document {
	tenantId: string
	brandId: string
	name: string
	description?: string
	createdBy: {
		_id: string
		displayName: string
		createdAt: Date
	}
	updatedBy?: {
		_id: string
		displayName: string
		updatedAt: Date
	}
	createdAt: Date
	updatedAt: Date
}

const BrandSchema = new Schema<IBrand>({
	brandId: { type: String, required: true },
	name: { type: String, required: true, index: true },
	description: { type: String },
	createdBy: {
		_id: String,
		displayName: String,
		createdAt: Date,
	},
	updatedBy: {
		_id: String,
		displayName: String,
		updatedAt: Date,
	},
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
})

tenantScopedSchema(BrandSchema)
BrandSchema.index({ tenantId: 1, brandId: 1 }, { unique: true })

export const Brand = mongoose.model<IBrand>('Brand', BrandSchema)
