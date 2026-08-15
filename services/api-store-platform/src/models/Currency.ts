import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ICurrency extends Document<string> {
	currencyId: string
	tenantId: string
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

const CurrencySchema = new Schema<ICurrency>({
	_id: { type: String, required: true },
	currencyId: { type: String, required: true, index: true },
	internalCode: { type: String, index: true, uppercase: true },
	name: { type: String, required: true, index: true },
})

tenantScopedSchema(CurrencySchema)
CurrencySchema.index(
	{ tenantId: 1, internalCode: 1 },
	{ unique: true, sparse: true },
)

export const Currency = mongoose.model<ICurrency>('Currency', CurrencySchema)
