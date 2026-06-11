import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'
import { UserAPIFormat } from '../shared/types/mongodb'

export interface ICustomer extends Document {
	tenantId: string
	_id: string
	customerId: string
	internalCode: string
	name: string
	email?: string
	phone?: string
	country?: string
	createdBy: UserAPIFormat
	updatedBy?: UserAPIFormat & { updatedAt: Date }
	createdAt: Date
	updatedAt: Date
}

const CustomerSchema = new Schema<ICustomer>({
	tenantId: { type: String, required: true, index: true },
	_id: { type: String, required: true },
	customerId: { type: String, required: true, index: true },
	internalCode: { type: String, index: true, uppercase: true },
	name: { type: String, required: true, index: true },
	email: { type: String },
	phone: { type: String },
	country: { type: String },
	updatedBy: {
		_id: String,
		displayName: String,
		role: String,
		updatedAt: Date,
	},
	createdBy: {
		_id: String,
		displayName: String,
		role: String,
	},
})

tenantScopedSchema(CustomerSchema)
CustomerSchema.index(
	{ tenantId: 1, internalCode: 1 },
	{ unique: true, sparse: true },
)
export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema)
