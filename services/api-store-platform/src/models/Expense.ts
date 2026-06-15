import mongoose, { Document, Schema } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IExpense extends Document {
	_id: string
	expenseId: string
	tenantId: string
	name: string
	internalCode?: string
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
	createdAt: Date
	updatedAt: Date
}

const ExpenseSchema = new Schema<IExpense>(
	{
		_id: { type: String, required: true },
		expenseId: { type: String, required: true, index: true },
		name: { type: String, required: true, trim: true, index: true },
		internalCode: { type: String, index: true, uppercase: true },
		createdBy: {
			_id: String,
			displayName: String,
			createdAt: Date,
		},
		updatedBy: {
			_id: String,
			displayName: String,
			updatedAt: Date,
		},
	},
	{ timestamps: true },
)

tenantScopedSchema(ExpenseSchema)
ExpenseSchema.index({ tenantId: 1, expenseId: 1 }, { unique: true })
ExpenseSchema.index(
	{ tenantId: 1, internalCode: 1 },
	{ unique: true, sparse: true },
)

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema)
