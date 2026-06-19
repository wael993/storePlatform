import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IUnit extends Document {
	_id: string
	tenantId: string
	name: string
	internalCode: string
	createdBy: {
		_id: string
		displayName: string
		createdAt: Date
	}
	updatedBy: {
		_id: string
		displayName: string
		updatedAt: Date
	}
}

const UnitSchema = new Schema<IUnit>(
	{
		_id: { type: String, required: true },
		name: { type: String, required: true, trim: true, index: true },
		internalCode: { type: String, index: true, uppercase: true },
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
	},
	{ timestamps: true },
)

tenantScopedSchema(UnitSchema)
UnitSchema.index({ tenantId: 1, _id: 1 }, { unique: true })

export const Unit = mongoose.model<IUnit>('Unit', UnitSchema)
