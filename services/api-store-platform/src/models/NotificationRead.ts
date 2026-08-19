import mongoose, { Document, Schema } from 'mongoose'

export interface INotificationRead extends Document {
	tenantId: string
	userId: string
	runAt: Date
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
	},
	{ timestamps: true },
)

NotificationReadSchema.index(
	{ tenantId: 1, userId: 1, runAt: 1 },
	{ unique: true },
)

export const NotificationRead = mongoose.model<INotificationRead>(
	'NotificationRead',
	NotificationReadSchema,
)
