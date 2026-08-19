import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface INegativeQuantitySnapshot extends Document {
	tenantId: string
	runAt: Date
	productIds: string[]
	count: number
	createdBy: {
		_id: string
		displayName: string
		role?: string
		createdAt: Date
	}
}

const NegativeQuantitySnapshotSchema: Schema<INegativeQuantitySnapshot> =
	new mongoose.Schema(
		{
			runAt: {
				type: Date,
				required: true,
			},
			productIds: {
				type: [String],
				required: true,
			},
			count: {
				type: Number,
				required: true,
				min: 1,
			},
		},
		{ timestamps: true },
	)

tenantScopedSchema(NegativeQuantitySnapshotSchema)
// tenantScopedSchema already indexes tenantId; upgrade it to unique in place
// instead of declaring a second index on the same key (avoids Mongoose's
// duplicate schema index warning).
NegativeQuantitySnapshotSchema.path('tenantId').index({ unique: true })

export const NegativeQuantitySnapshot =
	mongoose.model<INegativeQuantitySnapshot>(
		'NegativeQuantitySnapshot',
		NegativeQuantitySnapshotSchema,
	)
