import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ISyncMutation extends Document {
	tenantId: string
	clientMutationId: string
	entity: string
	operation: string
	result?: Record<string, unknown>
	error?: string
	processedAt: Date
}

const SyncMutationSchema: Schema<ISyncMutation> = new mongoose.Schema(
	{
		clientMutationId: {
			type: String,
			required: true,
			trim: true,
		},
		entity: { type: String, required: true, trim: true },
		operation: { type: String, required: true, trim: true },
		result: { type: Schema.Types.Mixed },
		error: { type: String, trim: true },
		processedAt: { type: Date, default: Date.now },
	},
	{ timestamps: true },
)

tenantScopedSchema(SyncMutationSchema)
SyncMutationSchema.index({ tenantId: 1, clientMutationId: 1 }, { unique: true })

export const SyncMutation = mongoose.model<ISyncMutation>(
	'SyncMutation',
	SyncMutationSchema,
)

export default SyncMutation
