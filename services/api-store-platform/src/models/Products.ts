import mongoose, { Schema, Document } from 'mongoose'

export interface IProduct extends Document {
	productId: string
	id: string
	name: string
	price: number
	barcode: string
	count: number
	description?: string
	createdAt: Date
	updatedAt: Date
}

const ProductSchema: Schema<IProduct> = new mongoose.Schema(
	{
		productId: {
			type: String,
			required: [true, 'Product ID is required'],
			unique: true,
			trim: true,
		},
		id: {
			type: String,
			required: [true, 'Product country ID is required'],
			unique: true,
			trim: false,
		},
		name: {
			type: String,
			required: [true, 'Product name is required'],
			trim: true,
			maxlength: [100, 'Name cannot exceed 100 characters'],
		},
		price: {
			type: Number,
			required: [true, 'Price is required'],
			min: [0, 'Price must be positive'],
		},
		barcode: {
			type: String,
			required: [true, 'Barcode is required'],
			unique: true,
			// trim: true,
			//match: [/^\d{5,30}$/, 'Barcode must be 12-13 digits'],
		},
		count: {
			type: Number,
			required: [true, 'Count is required'],
			min: [0, 'Count cannot be negative'],
		},
		description: {
			type: String,
			trim: true,
			maxlength: [500, 'Description cannot exceed 500 characters'],
		},
	},
	{ timestamps: true },
)

export const Product = mongoose.model<IProduct>('Products', ProductSchema)
