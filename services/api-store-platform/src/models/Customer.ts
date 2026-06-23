import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ICustomer extends Document {
	tenantId: string
	customerId: string
	internalCode: string
	name: string
	email?: string
	phone?: string
	country?: string
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

const CustomerSchema = new Schema<ICustomer>({
	customerId: { type: String, required: true, index: true },
	internalCode: { type: String, index: true, uppercase: true },
	name: { type: String, required: true, index: true },
	email: { type: String },
	phone: { type: String },
	country: { type: String },
})

tenantScopedSchema(CustomerSchema)
CustomerSchema.index(
	{ tenantId: 1, internalCode: 1 },
	{ unique: true, sparse: true },
)

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema)
