import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IUnit extends Document {
	tenantId: string
	unitId: string
	name: string
	internalCode?: string
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

const UnitSchema = new Schema<IUnit>({
	unitId: { type: String, required: true },
	name: { type: String, required: true, trim: true, index: true },
	internalCode: { type: String, uppercase: true },
})

tenantScopedSchema(UnitSchema)
UnitSchema.index({ tenantId: 1, unitId: 1 }, { unique: true })

export const Unit = mongoose.model<IUnit>('Unit', UnitSchema)
