import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export const NEGATIVE_QUANTITY_DIGEST = 'NEGATIVE_QUANTITY_DIGEST'
export const MISSING_PURCHASE_PRICE_DIGEST = 'MISSING_PURCHASE_PRICE_DIGEST'

export const PRODUCT_DIGEST_TYPES = [
	NEGATIVE_QUANTITY_DIGEST,
	MISSING_PURCHASE_PRICE_DIGEST,
] as const

export type ProductDigestType = (typeof PRODUCT_DIGEST_TYPES)[number]

export const isProductDigestType = (
	value: unknown,
): value is ProductDigestType =>
	typeof value === 'string' &&
	PRODUCT_DIGEST_TYPES.includes(value as ProductDigestType)

export interface INegativeQuantitySnapshot extends Document {
	tenantId: string
	type: ProductDigestType
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
			type: {
				type: String,
				required: true,
				enum: PRODUCT_DIGEST_TYPES,
			},
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
NegativeQuantitySnapshotSchema.index({ tenantId: 1, type: 1 }, { unique: true })

export const NegativeQuantitySnapshot =
	mongoose.model<INegativeQuantitySnapshot>(
		'NegativeQuantitySnapshot',
		NegativeQuantitySnapshotSchema,
	)
