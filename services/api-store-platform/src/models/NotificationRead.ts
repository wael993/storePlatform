import mongoose, { Document, Schema } from 'mongoose'
import {
	PRODUCT_DIGEST_TYPES,
	ProductDigestType,
} from './NegativeQuantitySnapshot'

export interface INotificationRead extends Document {
	tenantId: string
	userId: string
	runAt: Date
	type: ProductDigestType
}

const NotificationReadSchema: Schema<INotificationRead> = new mongoose.Schema(
	{
		tenantId: {
			type: String,
			required: [true, 'tenantId is required'],
			trim: true,
			index: true,
		},
		userId: {
			type: String,
			required: [true, 'userId is required'],
			trim: true,
		},
		runAt: {
			type: Date,
			required: true,
		},
		type: {
			type: String,
			required: [true, 'type is required'],
			enum: PRODUCT_DIGEST_TYPES,
			trim: true,
		},
	},
	{ timestamps: true },
)

NotificationReadSchema.index(
	{ tenantId: 1, userId: 1, runAt: 1, type: 1 },
	{ unique: true },
)

export const NotificationRead = mongoose.model<INotificationRead>(
	'NotificationRead',
	NotificationReadSchema,
)
