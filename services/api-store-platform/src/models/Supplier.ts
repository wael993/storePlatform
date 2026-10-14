import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ISupplier extends Document {
	tenantId: string
	name: string
	supplierId: string
	internalCode?: string
	email?: string
	phone?: string
	country?: string
	vatId?: string
	aliases?: string[]
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
	openingBalances?: Array<{
		currencyId: string
		currencyCode: string
		amount: number
		direction: 'owed_to_us' | 'we_owe'
	}>
}

const SupplierSchema = new Schema<ISupplier>({
	name: { type: String, required: true, index: true },
	supplierId: { type: String, required: true, index: true },
	internalCode: { type: String, uppercase: true },
	email: { type: String },
	phone: { type: String },
	country: { type: String },
	vatId: { type: String, trim: true },
	aliases: [{ type: String, trim: true, maxlength: 100 }],
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

tenantScopedSchema(SupplierSchema)
SupplierSchema.index({ tenantId: 1, supplierId: 1 }, { unique: true })

export const Supplier = mongoose.model<ISupplier>('Supplier', SupplierSchema)
