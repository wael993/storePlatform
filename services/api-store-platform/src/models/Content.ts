import mongoose, { Schema, Document } from 'mongoose'

interface IContent extends Document {
	header: string
	supHeader: string
	text: string
	createdAt: Date
	contentNumber: Number
	isDefault: boolean
}

const UserSchema: Schema<IContent> = new mongoose.Schema(
	{
		header: {
			type: String,
			required: [true, 'header is required'],
			unique: true,
		},
		supHeader: {
			type: String,
			required: [true, 'supHeader is required'],
			unique: true,
		},
		text: {
			type: String,
			required: [true, 'supHeader is required'],
			unique: true,
		},
		contentNumber: {
			type: Number,
			required: [true, 'supHeader is required'],
			unique: true,
		},
		isDefault: {
			type: Boolean,
			default: false, // Default is false
		},
	},
	{ timestamps: true }
)

const User = mongoose.model<IContent>('Content', UserSchema)

export default User
