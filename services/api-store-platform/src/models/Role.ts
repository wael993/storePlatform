import mongoose, { Document, Schema } from 'mongoose'

export type RoleAccessLevel = 'NONE' | 'SELF' | 'TENANT' | 'GLOBAL'

export interface RoleMethodPermission {
	accessLevel: RoleAccessLevel
	fields: string[]
}

export interface RoleFrontendResourcePermission {
	access: boolean
	allowedActions?: string[]
}

export interface IRole extends Document {
	_id: string
	name: string
	resources: Record<string, Record<string, RoleMethodPermission>>
	include: string[]
	frontendResources: Record<string, RoleFrontendResourcePermission>
	createdAt: Date
	updatedAt: Date
}

const MethodPermissionSchema = new Schema<RoleMethodPermission>(
	{
		accessLevel: {
			type: String,
			enum: ['NONE', 'SELF', 'TENANT', 'GLOBAL'],
			required: [true, 'accessLevel is required'],
		},
		fields: {
			type: [String],
			default: ['*'],
		},
	},
	{ _id: false },
)

const FrontendPermissionSchema = new Schema<RoleFrontendResourcePermission>(
	{
		access: {
			type: Boolean,
			required: [true, 'access is required'],
		},
		allowedActions: {
			type: [String],
			default: undefined,
		},
	},
	{ _id: false },
)

const RoleSchema = new Schema<IRole>(
	{
		_id: {
			type: String,
			required: [true, 'role id is required'],
			uppercase: true,
			trim: true,
		},
		name: {
			type: String,
			required: [true, 'name is required'],
			trim: true,
		},
		resources: {
			type: Map,
			of: {
				type: Map,
				of: MethodPermissionSchema,
			},
			default: {},
		},
		include: {
			type: [String],
			default: [],
		},
		frontendResources: {
			type: Map,
			of: FrontendPermissionSchema,
			default: {},
		},
	},
	{ timestamps: true },
)

const Role = mongoose.model<IRole>('Roles', RoleSchema)

export default Role
