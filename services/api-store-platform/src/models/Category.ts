import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ICategory extends Document {
	tenantId: string
	name: string
	description?: string
	parentCategoryId?: string
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

const CategorySchema = new Schema<ICategory>({
	name: { type: String, required: true, index: true },
	description: { type: String },
	parentCategoryId: { type: String, index: true },
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

tenantScopedSchema(CategorySchema)

export const Category = mongoose.model<ICategory>('Category', CategorySchema)
