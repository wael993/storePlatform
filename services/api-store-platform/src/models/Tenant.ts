import mongoose, { HydratedDocument, Model, Schema } from 'mongoose'
import {
	TENANT_STATUS,
	TenantStatus,
} from '../shared/constants/tenant.constants'
import {
	DEFAULT_TENANT_ACCESSIBLE_PAGES,
	TenantAccessiblePage,
} from '../shared/constants/tenantAccessiblePages'
import { MAX_INVOICE_AI_MONTHLY_LIMIT } from '../shared/constants/invoiceAi'
import {
	SUBSCRIPTION_STATUS,
	TenantSubscription,
} from '../shared/subscription/lifecycle'

export type InvoiceAiUsageState = {
	monthlyLimit: number
	activatedAt: Date
	periodStart: Date
	usedInPeriod: number
	carryOver: number
}

export interface ITenant {
	tenantId: string
	name: string
	domain: string
	status: TenantStatus
	accessiblePages: TenantAccessiblePage[]
	offlineEnabled: boolean
	invoiceAi?: InvoiceAiUsageState
	subscription?: TenantSubscription
	createdAt: Date
	updatedAt: Date
}

export type TenantDocument = HydratedDocument<ITenant>

const tenantSchema = new Schema<ITenant>(
	{
		tenantId: {
			type: String,
			required: [true, 'tenantId is required'],
			unique: true,
			trim: true,
			index: true,
		},
		name: {
			type: String,
			required: [true, 'name is required'],
			trim: true,
			maxlength: 100,
		},
		domain: {
			type: String,
			required: [true, 'domain is required'],
			unique: true,
			trim: true,
			lowercase: true,
			index: true,
			validate: {
				validator: (value: string) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value),
				message: 'Invalid domain format',
			},
		},
		status: {
			type: String,
			enum: Object.values(TENANT_STATUS),
			default: TENANT_STATUS.ACTIVE,
		},
		accessiblePages: {
			type: [String],
			default: () => [...DEFAULT_TENANT_ACCESSIBLE_PAGES],
		},
		offlineEnabled: {
			type: Boolean,
			default: true,
		},
		invoiceAi: {
			monthlyLimit: { type: Number, min: 1, max: MAX_INVOICE_AI_MONTHLY_LIMIT },
			activatedAt: { type: Date },
			periodStart: { type: Date },
			usedInPeriod: { type: Number, min: 0, default: 0 },
			carryOver: { type: Number, min: 0, default: 0 },
		},
		subscription: {
			startDate: { type: Date },
			renewalDate: { type: Date },
			status: {
				type: String,
				enum: Object.values(SUBSCRIPTION_STATUS),
			},
			renewalEnabled: { type: Boolean, default: true },
			lastRenewalDate: { type: Date, default: null },
			notifiedForDate: { type: String, default: null },
			createdAt: { type: Date },
			updatedAt: { type: Date },
		},
	},
	{
		timestamps: true,
		versionKey: false,
	},
)

const Tenant: Model<ITenant> =
	mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', tenantSchema)

export default Tenant
