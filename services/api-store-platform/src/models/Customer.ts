import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ICustomer extends Document {
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
	createdAt: Date
	updatedAt: Date
}

const CustomerSchema = new Schema<ICustomer>({
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
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
})

tenantScopedSchema(CustomerSchema)

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema)
