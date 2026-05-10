import mongoose, { Document, Schema } from 'mongoose'

export interface ITenant extends Document {
	tenantId: string
	name: string
	domain: string
	status: 'active' | 'inactive'
	createdAt: Date
	updatedAt: Date
}

const TenantSchema: Schema<ITenant> = new mongoose.Schema(
	{
		tenantId: {
			type: String,
			required: [true, 'tenantId is required'],
			unique: true,
			trim: true,
		},
		name: {
			type: String,
			required: [true, 'name is required'],
			trim: true,
		},
		domain: {
			type: String,
			required: [true, 'domain is required'],
			unique: true,
			trim: true,
			lowercase: true,
		},
		status: {
			type: String,
			enum: ['active', 'inactive'],
			default: 'active',
		},
	},
	{ timestamps: true },
)

const Tenant = mongoose.model<ITenant>('Tenant', TenantSchema)

export default Tenant
