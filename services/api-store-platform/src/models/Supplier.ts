import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface ISupplier extends Document {
	tenantId: string
	name: string
	supplierId: string
	internalCode?: string
	email?: string
	phone?: string
	country?: string
	vatId?: string
	aliases?: string[]
	createdBy: {
		_id: string
		displayName: string
		createdAt: Date
	}
	updatedBy?: {
		_id: string
		displayName: string
		updatedAt: Date
	}
}

const SupplierSchema = new Schema<ISupplier>({
	name: { type: String, required: true, index: true },
	supplierId: { type: String, required: true, index: true },
	internalCode: { type: String, index: true, uppercase: true },
	email: { type: String },
	phone: { type: String },
	country: { type: String },
	vatId: { type: String, trim: true },
	aliases: [{ type: String, trim: true, maxlength: 100 }],
})

tenantScopedSchema(SupplierSchema)
SupplierSchema.index({ tenantId: 1, supplierId: 1 }, { unique: true })

export const Supplier = mongoose.model<ISupplier>('Supplier', SupplierSchema)
