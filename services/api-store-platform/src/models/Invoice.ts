import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IInvoice extends Document {
	tenantId: string
	invoiceId: string
	invoiceNumber: string
	orderId?: string
	status: 'pending' | 'paid' | 'void'
	amount: number
	issuedAt: Date
	createdBy: string
	updatedBy?: string
	createdAt: Date
	updatedAt: Date
}

const InvoiceSchema: Schema<IInvoice> = new mongoose.Schema(
	{
		invoiceId: {
			type: String,
			required: [true, 'invoiceId is required'],
			unique: true,
			trim: true,
		},
		invoiceNumber: {
			type: String,
			required: [true, 'invoiceNumber is required'],
			trim: true,
		},
		orderId: {
			type: String,
			trim: true,
		},
		status: {
			type: String,
			enum: ['pending', 'paid', 'void'],
			default: 'pending',
		},
		amount: {
			type: Number,
			required: true,
			min: 0,
		},
		issuedAt: {
			type: Date,
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

tenantScopedSchema(InvoiceSchema)

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema)
