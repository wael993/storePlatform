import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IExpense extends Document<string> {
	expenseId: string
	tenantId: string
	name: string
	internalCode?: string
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

const ExpenseSchema = new Schema<IExpense>(
	{
		_id: { type: String, required: true },
		expenseId: { type: String, required: true, index: true },
		name: { type: String, required: true, trim: true, index: true },
		internalCode: { type: String, uppercase: true },
	},
	{ timestamps: true },
)

tenantScopedSchema(ExpenseSchema)
ExpenseSchema.index({ tenantId: 1, expenseId: 1 }, { unique: true })

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema)
