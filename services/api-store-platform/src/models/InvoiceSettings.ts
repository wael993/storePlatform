import mongoose, { Document, Schema } from 'mongoose'

export interface IInvoiceSettings extends Document {
	tenantId: string
	noMergeInvoiceLines: boolean
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
	},
	{ timestamps: true },
)

export default mongoose.model<IInvoiceSettings>(
	'InvoiceSettings',
	InvoiceSettingsSchema,
	'invoiceSettings',
)
