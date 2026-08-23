import mongoose, { Document, Model, Schema } from 'mongoose'
import { TenantRole } from '../shared/tenant'

export interface ITenantRolePermission extends Document {
	tenantId: string
	role: Exclude<TenantRole, 'owner'>
	see: string[]
	createdAt: Date
	updatedAt: Date
}

const TenantRolePermissionSchema = new Schema<ITenantRolePermission>(
	{
		tenantId: { type: String, required: true, index: true, trim: true },
		role: {
			type: String,
			required: true,
			enum: ['admin', 'cashier', 'employee'],
		},
		see: { type: [String], default: [] },
	},
	{ timestamps: true },
)

TenantRolePermissionSchema.index({ tenantId: 1, role: 1 }, { unique: true })

const TenantRolePermission: Model<ITenantRolePermission> =
	mongoose.models.TenantRolePermission ||
	mongoose.model<ITenantRolePermission>(
		'TenantRolePermission',
		TenantRolePermissionSchema,
	)

export default TenantRolePermission
