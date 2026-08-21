import mongoose, { HydratedDocument, Model, Schema } from 'mongoose'

export const RENEWAL_REQUEST_STATUS = {
	PENDING: 'pending',
	APPROVED: 'approved',
	REJECTED: 'rejected',
} as const

export type RenewalRequestStatus =
	(typeof RENEWAL_REQUEST_STATUS)[keyof typeof RENEWAL_REQUEST_STATUS]

export type RenewalRequestActor = {
	userId: string
	displayName: string
}

export interface ISubscriptionRenewalRequest {
	requestId: string
	tenantId: string
	tenantName: string
	requestedBy: RenewalRequestActor
	currentExpirationDate: Date
	status: RenewalRequestStatus
	requestedAt: Date
	reviewedAt: Date | null
	reviewedBy: RenewalRequestActor | null
	rejectionReason: string | null
	createdAt: Date
	updatedAt: Date
}

export type SubscriptionRenewalRequestDocument =
	HydratedDocument<ISubscriptionRenewalRequest>

const actorSchema = new Schema(
	{
		userId: { type: String, required: true, trim: true },
		displayName: { type: String, required: true, trim: true },
	},
	{ _id: false },
)

const schema = new Schema<ISubscriptionRenewalRequest>(
	{
		requestId: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			index: true,
		},
		tenantId: {
			type: String,
			required: true,
			trim: true,
			index: true,
		},
		tenantName: {
			type: String,
			required: true,
			trim: true,
		},
		requestedBy: { type: actorSchema, required: true },
		currentExpirationDate: { type: Date, required: true },
		status: {
			type: String,
			enum: Object.values(RENEWAL_REQUEST_STATUS),
			required: true,
			index: true,
		},
		requestedAt: { type: Date, required: true },
		reviewedAt: { type: Date, default: null },
		reviewedBy: { type: actorSchema, required: false },
		rejectionReason: { type: String, default: null, trim: true },
	},
	{ timestamps: true, versionKey: false },
)

schema.index(
	{ tenantId: 1 },
	{
		unique: true,
		partialFilterExpression: { status: RENEWAL_REQUEST_STATUS.PENDING },
	},
)

const SubscriptionRenewalRequest: Model<ISubscriptionRenewalRequest> =
	mongoose.models.SubscriptionRenewalRequest ||
	mongoose.model<ISubscriptionRenewalRequest>(
		'SubscriptionRenewalRequest',
		schema,
	)

export default SubscriptionRenewalRequest
