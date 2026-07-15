import mongoose, { Schema, Document } from 'mongoose'

export interface IUserSettings extends Document {
	tenantId: string
	userId: string
	productsPerPage: number
	displayLanguage: 'en' | 'de' | 'ar'
	defaultInvoiceCurrencyId?: string
	createdAt: Date
	updatedAt: Date
}

const UserSettingsSchema: Schema<IUserSettings> = new mongoose.Schema(
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
			index: true,
		},
		productsPerPage: {
			type: Number,
			default: 20,
			min: 1,
			max: 10000,
		},
		displayLanguage: {
			type: String,
			enum: ['en', 'de', 'ar'],
			default: 'en',
		},
		defaultInvoiceCurrencyId: {
			type: String,
			trim: true,
		},
	},
	{ timestamps: true },
)

// Create a compound index for tenant and user to ensure uniqueness
UserSettingsSchema.index({ tenantId: 1, userId: 1 }, { unique: true })

export default mongoose.model<IUserSettings>(
	'UserSettings',
	UserSettingsSchema,
	'userSettings',
)
