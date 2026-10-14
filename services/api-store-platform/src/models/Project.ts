import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IProject extends Document {
	tenantId: string
	projectId: string
	internalCode?: string
	name: string
	createdAt?: Date
	updatedAt?: Date
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

const ProjectSchema = new Schema<IProject>(
	{
		projectId: { type: String, required: true, index: true, unique: true },
		internalCode: { type: String, uppercase: true },
		name: { type: String, required: true, index: true },
	},
	{ timestamps: true },
)

tenantScopedSchema(ProjectSchema)
ProjectSchema.index({ tenantId: 1, projectId: 1 }, { unique: true })

export const Project = mongoose.model<IProject>('Project', ProjectSchema)
