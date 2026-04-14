import mongoose, { Schema, Document } from 'mongoose'

interface IUser extends Document {
	userId: string
	displayName: string
	user: UserData
	email: string
	password: string
	role: 'admin' | 'editor'
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
			unique: true,
			trim: true,
			minlength: [13, 'Username must be at least 13 characters long'],
			maxlength: [50, 'Username must be less than 50 characters long'],
		},
		displayName: {
			type: String,
			required: [true, 'displayName is required'],
			unique: true,
			trim: false,
			minlength: [3, 'displayName must be at least 3 characters long'],
			maxlength: [30, 'displayName must be less than 30 characters long'],
		},
		user: {
			firstName: {
				type: String,
				required: [true, 'firstName is required'],
				unique: true,
				trim: false,
				minlength: [3, 'firstName must be at least 3 characters long'],
				maxlength: [30, 'firstName must be less than 30 characters long'],
			},
			lastName: {
				type: String,
				required: [true, 'lastName is required'],
				unique: true,
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
			unique: true,
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
			enum: ['admin', 'editor'],
			default: 'editor',
		},

		avatarColorId: {
			type: Number,
			unique: true,
			trim: false,
		},
	},
	{ timestamps: true },
)

const User = mongoose.model<IUser>('User', UserSchema)

export default User
