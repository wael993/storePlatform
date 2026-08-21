import mongoose, { HydratedDocument, Model, Schema } from 'mongoose'

export const SUBSCRIPTION_PAYMENT_SETTINGS_ID = 'default'

export type SubscriptionPaymentMethod = {
	id: string
	name: string
	details: string
	qrUrl: string
}

export interface ISubscriptionPaymentSettings {
	settingsId: string
	contactName: string
	contactEmail: string
	contactPhone: string
	methods: SubscriptionPaymentMethod[]
	createdAt: Date
	updatedAt: Date
}

export type SubscriptionPaymentSettingsDocument =
	HydratedDocument<ISubscriptionPaymentSettings>

const methodSchema = new Schema<SubscriptionPaymentMethod>(
	{
		id: { type: String, required: true, trim: true },
		name: { type: String, required: true, trim: true, maxlength: 80 },
		details: { type: String, default: '', trim: true, maxlength: 500 },
		qrUrl: { type: String, default: '', trim: true, maxlength: 2000 },
	},
	{ _id: false },
)

const schema = new Schema<ISubscriptionPaymentSettings>(
	{
		settingsId: {
			type: String,
			required: true,
			unique: true,
			default: SUBSCRIPTION_PAYMENT_SETTINGS_ID,
		},
		contactName: { type: String, default: '', trim: true, maxlength: 100 },
		contactEmail: { type: String, default: '', trim: true, maxlength: 120 },
		contactPhone: { type: String, default: '', trim: true, maxlength: 40 },
		methods: { type: [methodSchema], default: [] },
	},
	{ timestamps: true, versionKey: false },
)

const SubscriptionPaymentSettings: Model<ISubscriptionPaymentSettings> =
	mongoose.models.SubscriptionPaymentSettings ||
	mongoose.model<ISubscriptionPaymentSettings>(
		'SubscriptionPaymentSettings',
		schema,
	)

export default SubscriptionPaymentSettings
