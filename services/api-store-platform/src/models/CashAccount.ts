import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ICashAccount extends Document {
	tenantId: string
	cashAccountId: string
	warehouseId: string
	/** Extensible type code, e.g. daily_cash | cash_reserve | online */
	type: string
	name: string
	isActive: boolean
	allowNegativeBalance: boolean
	/** Denormalized primary-currency balance; must match ledger sum. */
	balance: number
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
	createdAt: Date
	updatedAt: Date
}

const CashAccountSchema: Schema<ICashAccount> = new mongoose.Schema(
	{
		cashAccountId: {
			type: String,
			required: true,
			trim: true,
		},
		warehouseId: {
			type: String,
			required: true,
			trim: true,
		},
		type: {
			type: String,
			required: true,
			trim: true,
		},
		name: {
			type: String,
			required: true,
			trim: true,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		allowNegativeBalance: {
			type: Boolean,
			default: false,
		},
		balance: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true },
)

tenantScopedSchema(CashAccountSchema)

CashAccountSchema.index(
	{ tenantId: 1, warehouseId: 1, type: 1 },
	{ unique: true },
)

CashAccountSchema.index({ tenantId: 1, cashAccountId: 1 }, { unique: true })

CashAccountSchema.index({ tenantId: 1, warehouseId: 1, isActive: 1 })

export const CashAccount = mongoose.model<ICashAccount>(
	'CashAccount',
	CashAccountSchema,
)
