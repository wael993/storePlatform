import mongoose, { Document, Schema } from 'mongoose'

export interface ICurrencySettingItem {
	currencyId: string
	name: string
	internalCode?: string
	exchangeRate?: number
	exchangeRateUnitCurrencyId?: string
}

export interface ICurrencySettings extends Document {
	tenantId: string
	primaryCurrency: ICurrencySettingItem | null
	secondaryCurrencies: ICurrencySettingItem[]
	createdAt: Date
	updatedAt: Date
}

const CurrencySettingItemSchema = new Schema<ICurrencySettingItem>(
	{
		currencyId: { type: String, required: true },
		name: { type: String, required: true, trim: true },
		internalCode: { type: String, trim: true, uppercase: true },
		exchangeRate: { type: Number, min: 0 },
		exchangeRateUnitCurrencyId: { type: String, trim: true },
	},
	{ _id: false },
)

const CurrencySettingsSchema = new Schema<ICurrencySettings>(
	{
		tenantId: {
			type: String,
			required: [true, 'tenantId is required'],
			trim: true,
			index: true,
			unique: true,
		},
		primaryCurrency: {
			type: CurrencySettingItemSchema,
			default: null,
		},
		secondaryCurrencies: {
			type: [CurrencySettingItemSchema],
			default: [],
		},
	},
	{ timestamps: true },
)

export default mongoose.model<ICurrencySettings>(
	'CurrencySettings',
	CurrencySettingsSchema,
	'currencySettings',
)
