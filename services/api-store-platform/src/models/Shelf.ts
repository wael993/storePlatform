import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

interface IShelf extends Document {
	tenantId: string
	shelfId: string
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
}

export const ShelfSchema = new Schema<IShelf>({
	shelfId: { type: String, required: true, unique: true, index: true },
	name: { type: String, required: true, index: true },
	description: { type: String },
})

tenantScopedSchema(ShelfSchema)
ShelfSchema.index({ tenantId: 1, shelfId: 1 }, { unique: true })

export const Shelf = mongoose.model<IShelf>('Shelf', ShelfSchema)
