import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IReport extends Document {
	tenantId: string
	reportId: string
	name: string
	type: 'sales' | 'inventory' | 'finance' | 'operations'
	periodStart: Date
	periodEnd: Date
	data: Record<string, unknown>
	createdBy: string
	updatedBy?: string
	createdAt: Date
	updatedAt: Date
}

const ReportSchema: Schema<IReport> = new mongoose.Schema(
	{
		reportId: {
			type: String,
			required: [true, 'reportId is required'],
			unique: true,
			trim: true,
		},
		name: {
			type: String,
			required: [true, 'name is required'],
			trim: true,
		},
		type: {
			type: String,
			enum: ['sales', 'inventory', 'finance', 'operations'],
			required: true,
		},
		periodStart: {
			type: Date,
			required: true,
		},
		periodEnd: {
			type: Date,
			required: true,
		},
		data: {
			type: Schema.Types.Mixed,
			required: true,
		},
		createdBy: {
			type: String,
			required: true,
			trim: true,
		},
		updatedBy: {
			type: String,
			trim: true,
		},
	},
	{ timestamps: true },
)

tenantScopedSchema(ReportSchema)

export const Report = mongoose.model<IReport>('Report', ReportSchema)
