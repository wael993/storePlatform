import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export type ActionType =
	| 'purchase'
	| 'procurement'
	| 'receipt'
	| 'expense'
	| 'test'

export interface IDailyAction extends Document {
	tenantId: string
	actionId: string
	type: ActionType
	salesArea?: string
	locationCustomer?: string
	shopTerminal?: string
	promotionSpace?: string
	amount?: number
	description?: string
	reference?: string
	createdBy: string
	updatedBy?: string
	createdAt: Date
	updatedAt: Date
}

const DailyActionSchema: Schema<IDailyAction> = new mongoose.Schema(
	{
		actionId: {
			type: String,
			required: [true, 'actionId is required'],
			unique: true,
			trim: true,
		},
		type: {
			type: String,
			enum: ['purchase', 'procurement', 'receipt', 'expense', 'test'],
			required: [true, 'type is required'],
		},
		salesArea: {
			type: String,
			trim: true,
		},
		locationCustomer: {
			type: String,
			trim: true,
		},
		shopTerminal: {
			type: String,
			trim: true,
		},
		promotionSpace: {
			type: String,
			trim: true,
		},
		amount: {
			type: Number,
		},
		description: {
			type: String,
			trim: true,
		},
		reference: {
			type: String,
			trim: true,
		},
		createdBy: {
			type: String,
			required: true,
		},
		updatedBy: {
			type: String,
		},
	},
	{
		timestamps: true,
	},
)

tenantScopedSchema(DailyActionSchema)

// Create indexes
DailyActionSchema.index({ tenantId: 1, type: 1 })
DailyActionSchema.index({ tenantId: 1, createdAt: -1 })

export const DailyAction = mongoose.model<IDailyAction>(
	'DailyAction',
	DailyActionSchema,
)
