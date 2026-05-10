import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'
import { TENANT_ROLES, TenantRole } from '../shared/tenant'

export interface IUser extends Document {
	tenantId: string
	userId: string
	displayName: string
	user: UserData
	email: string
	password: string
	role: TenantRole
	tokenVersion: number
	avatarColorId: number
	createdAt: Date
	updatedAt: Date
}
interface UserData {
	firstName: string
	lastName: string
	isInternal: boolean
}

const UserSchema: Schema<IUser> = new mongoose.Schema(
	{
		userId: {
			type: String,
			required: [true, 'userId is required'],
			trim: true,
			minlength: [13, 'Username must be at least 13 characters long'],
			maxlength: [50, 'Username must be less than 50 characters long'],
		},
		displayName: {
			type: String,
			required: [true, 'displayName is required'],
			trim: false,
			minlength: [3, 'displayName must be at least 3 characters long'],
			maxlength: [30, 'displayName must be less than 30 characters long'],
		},
		user: {
			firstName: {
				type: String,
				required: [true, 'firstName is required'],
				trim: false,
				minlength: [3, 'firstName must be at least 3 characters long'],
				maxlength: [30, 'firstName must be less than 30 characters long'],
			},
			lastName: {
				type: String,
				required: [true, 'lastName is required'],
				trim: false,
				minlength: [3, 'lastName must be at least 3 characters long'],
				maxlength: [30, 'lastName must be less than 30 characters long'],
			},
			isInternal: {
				type: Boolean,
				required: [true, 'isInternal is required'],
			},
		},
		email: {
			type: String,
			required: [true, 'Email is required'],
			lowercase: true, // Ensure email is stored in lowercase
			match: [/.+\@.+\..+/, 'Please provide a valid email address'], // Email format validation
		},
		password: {
			type: String,
			required: [true, 'Password is required'],
			minlength: [6, 'Password must be at least 6 characters long'],
		},
		role: {
			type: String,
			enum: TENANT_ROLES,
			default: 'employee',
		},
		tokenVersion: {
			type: Number,
			default: 0,
		},

		avatarColorId: {
			type: Number,
			trim: false,
		},
	},
	{ timestamps: true },
)

tenantScopedSchema(UserSchema)

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true })
UserSchema.index({ tenantId: 1, userId: 1 }, { unique: true })
UserSchema.index({ tenantId: 1, displayName: 1 }, { unique: true })

const User = mongoose.model<IUser>('User', UserSchema)

export default User
