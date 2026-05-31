import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ICurrency extends Document {
	tenantId: string
	code: string
	label: string
	createdAt: Date
	updatedAt: Date
}

const CurrencySchema = new Schema<ICurrency>(
	{
		code: {
			type: String,
			required: true,
			trim: true,
			uppercase: true,
			index: true,
		},
		label: { type: String, required: true, trim: true },
	},
	{ timestamps: true },
)

tenantScopedSchema(CurrencySchema)
CurrencySchema.index({ tenantId: 1, code: 1 }, { unique: true })

export const Currency = mongoose.model<ICurrency>('Currency', CurrencySchema)
