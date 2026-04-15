import mongoose, { Schema, Document } from 'mongoose'

export interface IRefreshToken extends Document {
	userId: mongoose.Types.ObjectId
	tokenHash: string
	ip: string
	userAgent: string
	expiresAt: Date
	createdAt: Date
}

const RefreshTokenSchema: Schema<IRefreshToken> = new mongoose.Schema(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},
		tokenHash: {
			type: String,
			required: true,
			unique: true,
		},
		ip: {
			type: String,
			required: true,
		},
		userAgent: {
			type: String,
			required: true,
		},
		expiresAt: {
			type: Date,
			required: true,
			index: { expires: 0 }, // MongoDB TTL index — auto-deletes expired docs
		},
	},
	{ timestamps: true },
)

const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema)

export default RefreshToken
