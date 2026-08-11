import mongoose, { Document, Schema } from 'mongoose'

export interface IInvoiceSettings extends Document {
	tenantId: string
	noMergeInvoiceLines: boolean
	displayName?: string
	address?: string
	phone?: string
	email?: string
	taxNumber?: string
	logoUrl?: string
	footerNote?: string
	createdAt: Date
	updatedAt: Date
}

const InvoiceSettingsSchema = new Schema<IInvoiceSettings>(
	{
		tenantId: {
			type: String,
			required: [true, 'tenantId is required'],
			trim: true,
			index: true,
			unique: true,
		},
		noMergeInvoiceLines: {
			type: Boolean,
			default: false,
		},
		displayName: {
			type: String,
			trim: true,
			default: '',
		},
		address: {
			type: String,
			trim: true,
			default: '',
		},
		phone: {
			type: String,
			trim: true,
			default: '',
		},
		email: {
			type: String,
			trim: true,
			default: '',
		},
		taxNumber: {
			type: String,
			trim: true,
			default: '',
		},
		logoUrl: {
			type: String,
			trim: true,
			default: '',
		},
		footerNote: {
			type: String,
			trim: true,
			default: '',
		},
	},
	{ timestamps: true },
)

export default mongoose.model<IInvoiceSettings>(
	'InvoiceSettings',
	InvoiceSettingsSchema,
	'invoiceSettings',
)
