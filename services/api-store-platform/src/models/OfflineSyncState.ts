import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IOfflineSyncState extends Document {
	tenantId: string
	nextBlockStart: number
	minOnlineInvoiceNumber: number
}

const OfflineSyncStateSchema: Schema<IOfflineSyncState> = new mongoose.Schema(
	{
		nextBlockStart: {
			type: Number,
			required: true,
			default: 1,
		},
		minOnlineInvoiceNumber: {
			type: Number,
			required: true,
			default: 1,
		},
	},
	{ timestamps: true },
)

tenantScopedSchema(OfflineSyncStateSchema)
OfflineSyncStateSchema.index({ tenantId: 1 }, { unique: true })

export const OfflineSyncState = mongoose.model<IOfflineSyncState>(
	'OfflineSyncState',
	OfflineSyncStateSchema,
)

export default OfflineSyncState
