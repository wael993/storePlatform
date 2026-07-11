import mongoose, { HydratedDocument, Model, Schema } from 'mongoose'
import {
	TENANT_STATUS,
	TenantStatus,
} from '../shared/constants/tenant.constants'
import {
	DEFAULT_TENANT_ACCESSIBLE_PAGES,
	TenantAccessiblePage,
} from '../shared/constants/tenantAccessiblePages'

export interface ITenant {
	tenantId: string
	name: string
	domain: string
	status: TenantStatus
	accessiblePages: TenantAccessiblePage[]
	offlineEnabled: boolean
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
	},
	{
		timestamps: true,
		versionKey: false,
		toJSON: {
			transform: (_, ret) => {
				delete ret._id

				return ret
			},
		},
	},
)

const Tenant: Model<ITenant> =
	mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', tenantSchema)

export default Tenant
