import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ICustomer extends Document {
	tenantId: string
	customerId: string
	internalCode?: string
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
	openingBalances?: Array<{
		currencyId: string
		currencyCode: string
		amount: number
		direction: 'owed_to_us' | 'we_owe'
	}>
}

const CustomerSchema = new Schema<ICustomer>({
	customerId: { type: String, required: true, index: true, unique: true },
	internalCode: { type: String, uppercase: true },
	name: { type: String, required: true, index: true },
	email: { type: String },
	phone: { type: String },
	country: { type: String },
	openingBalances: {
		type: [
			new Schema(
				{
					currencyId: { type: String, required: true, trim: true },
					currencyCode: { type: String, required: true, trim: true },
					amount: { type: Number, required: true, min: 0 },
					direction: {
						type: String,
						enum: ['owed_to_us', 'we_owe'],
						required: true,
					},
				},
				{ _id: false },
			),
		],
		default: undefined,
	},
})

tenantScopedSchema(CustomerSchema)
CustomerSchema.index({ tenantId: 1, customerId: 1 }, { unique: true })

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema)
