import mongoose, { Schema, Document } from 'mongoose'

export const COLUMN_CONFIG_LIST_TYPES = [
	'products',
	'suppliers',
	'customers',
	'categories',
	'partners',
] as const

export type ColumnConfigListType = (typeof COLUMN_CONFIG_LIST_TYPES)[number]

export interface IColumnConfig {
	id: string
	listType: ColumnConfigListType
	name: string
	cols: string
	isDefault: boolean
}

export interface IUserSettings extends Document {
	tenantId: string
	userId: string
	productsPerPage: number
	displayLanguage: 'en' | 'de' | 'ar'
	defaultInvoiceCurrencyId?: string
	columnConfigs: IColumnConfig[]
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
		columnConfigs: {
			type: [
				{
					id: { type: String, required: true, trim: true },
					listType: {
						type: String,
						required: true,
						enum: COLUMN_CONFIG_LIST_TYPES,
					},
					name: { type: String, required: true, trim: true, maxlength: 80 },
					cols: { type: String, required: true, trim: true, maxlength: 2000 },
					isDefault: { type: Boolean, default: false },
					_id: false,
				},
			],
			default: [],
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
