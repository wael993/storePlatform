import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IUnit extends Document {
	tenantId: string
	name: string
	createdAt: Date
	updatedAt: Date
}

const UnitSchema = new Schema<IUnit>(
	{
		name: { type: String, required: true, trim: true, index: true },
	},
	{ timestamps: true },
)

tenantScopedSchema(UnitSchema)
UnitSchema.index({ tenantId: 1, name: 1 }, { unique: true })

export const Unit = mongoose.model<IUnit>('Unit', UnitSchema)
