import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ICashLedgerEntry extends Document {
	tenantId: string
	ledgerEntryId: string
	warehouseId: string
	cashAccountId: string
	accountType: string
	/** Signed primary-currency amount. */
	amount: number
	movementType: string
	referenceType: string
	referenceId: string
	idempotencyKey: string
	transferGroupId?: string
	reversesLedgerEntryId?: string
	reason?: string
	createdBy: {
		_id: string
		displayName: string
		role?: string
		createdAt: Date
	}
	createdAt: Date
	updatedAt: Date
}

const CashLedgerEntrySchema: Schema<ICashLedgerEntry> = new mongoose.Schema(
	{
		ledgerEntryId: {
			type: String,
			required: true,
			trim: true,
		},
		warehouseId: {
			type: String,
			required: true,
			trim: true,
		},
		cashAccountId: {
			type: String,
			required: true,
			trim: true,
		},
		accountType: {
			type: String,
			required: true,
			trim: true,
		},
		amount: {
			type: Number,
			required: true,
		},
		movementType: {
			type: String,
			required: true,
			trim: true,
		},
		referenceType: {
			type: String,
			required: true,
			trim: true,
		},
		referenceId: {
			type: String,
			required: true,
			trim: true,
		},
		idempotencyKey: {
			type: String,
			required: true,
			trim: true,
		},
		transferGroupId: {
			type: String,
			trim: true,
		},
		reversesLedgerEntryId: {
			type: String,
			trim: true,
		},
		reason: {
			type: String,
			trim: true,
		},
	},
	{ timestamps: true },
)

tenantScopedSchema(CashLedgerEntrySchema)

CashLedgerEntrySchema.index(
	{ tenantId: 1, idempotencyKey: 1 },
	{ unique: true },
)

CashLedgerEntrySchema.index({ tenantId: 1, ledgerEntryId: 1 }, { unique: true })
CashLedgerEntrySchema.index({
	tenantId: 1,
	referenceType: 1,
	referenceId: 1,
})

CashLedgerEntrySchema.index({ tenantId: 1, cashAccountId: 1, createdAt: -1 })
CashLedgerEntrySchema.index({
	tenantId: 1,
	warehouseId: 1,
	accountType: 1,
	createdAt: -1,
})

export const CashLedgerEntry = mongoose.model<ICashLedgerEntry>(
	'CashLedgerEntry',
	CashLedgerEntrySchema,
)
