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
	entryType:
		| 'BUYING_ENTRY'
		| 'SELLING_ENTRY'
		| 'PAYMENT_ENTRY'
		| 'RECEIPT_ENTRY'
	productId: string
	productName?: string
	supplierId: string
	supplierName?: string
	customerId?: string
	customerName?: string
	currencyId: string
	currencyName: string
	unitId: string
	unitName: string
	weight: string
	singleUnitPrice?: string
	totalPrice?: string
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
			unique: [true, 'actionId must be unique'],
			trim: true,
		},
		entryType: {
			type: String,
			enum: ['BUYING_ENTRY', 'SELLING_ENTRY', 'PAYMENT_ENTRY', 'RECEIPT_ENTRY'],
			required: [true, 'entryType is required'],
		},
		productId: {
			type: String,
			trim: true,
			required: [true, 'productId is required'],
		},
		productName: {
			type: String,
			trim: true,
			required: [true, 'productName is required'],
		},
		supplierId: {
			type: String,
			trim: true,
		},
		supplierName: {
			type: String,
			trim: true,
		},
		customerId: {
			type: String,
			trim: true,
		},
		customerName: {
			type: String,
			trim: true,
		},
		currencyId: {
			type: String,
			trim: true,
			required: [true, 'currencyId is required'],
		},
		currencyName: {
			type: String,
			trim: true,
			required: [true, 'currencyName is required'],
		},
		unitId: {
			type: String,
			trim: true,
			required: [true, 'unitId is required'],
		},
		unitName: {
			type: String,
			trim: true,
			required: [true, 'unitName is required'],
		},
		weight: {
			type: String,
			trim: true,
			required: [true, 'weight is required'],
		},
		singleUnitPrice: {
			type: String,
			trim: true,
		},
		totalPrice: {
			type: String,
			trim: true,
		},
		createdBy: {
			type: String,
			required: [true, 'createdBy is required'],
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
DailyActionSchema.index({ tenantId: 1, entryType: 1 })
DailyActionSchema.index({ tenantId: 1, createdAt: -1 })

export const DailyAction = mongoose.model<IDailyAction>(
	'DailyAction',
	DailyActionSchema,
)
