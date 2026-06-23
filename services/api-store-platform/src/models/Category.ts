import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ICategory extends Document {
	tenantId: string
	name: string
	categoryId: string
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
}

const CategorySchema = new Schema<ICategory>({
	name: { type: String, required: true, index: true },
	categoryId: { type: String, required: true, index: true },
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
})

tenantScopedSchema(CategorySchema)

CategorySchema.index({ tenantId: 1, categoryId: 1 }, { unique: true })
export const Category = mongoose.model<ICategory>('Category', CategorySchema)
