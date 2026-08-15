import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IPartner extends Document<string> {
	tenantId: string
	name: string
	partnerId: string
	internalCode?: string
	email?: string
	phone?: string
	country?: string
	createdBy: {
		_id: string
		displayName: string
		role?: string
		createdAt: Date
	}
	updatedBy?: {
		_id: string
		displayName: string
		role?: string
		updatedAt: Date
	}
}

const PartnerSchema = new Schema<IPartner>({
	_id: { type: String, required: true },
	name: { type: String, required: true, index: true },
	partnerId: { type: String, required: true, index: true },
	internalCode: { type: String, index: true, uppercase: true },
	email: { type: String },
	phone: { type: String },
	country: { type: String },
})

tenantScopedSchema(PartnerSchema)
PartnerSchema.index({ tenantId: 1, partnerId: 1 }, { unique: true })

export const Partner = mongoose.model<IPartner>('Partner', PartnerSchema)
