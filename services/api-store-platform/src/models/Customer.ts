import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ICustomer extends Document {
	_id: { type: String; required: true }
	internalCode: { type: String; index: true }
	tenantId: string
	name: string
	email?: string
	phone?: string
	country?: string
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

const CustomerSchema = new Schema<ICustomer>({
	_id: { type: String, required: true },
	internalCode: { type: String, index: true, uppercase: true },
	name: { type: String, required: true, index: true },
	email: { type: String },
	phone: { type: String },
	country: { type: String },
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

tenantScopedSchema(CustomerSchema)
CustomerSchema.index({ tenantId: 1, _id: 1 }, { unique: true })
export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema)
