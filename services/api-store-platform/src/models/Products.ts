import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IProduct extends Document {
	tenantId: string
	productId: string
	name: string
	barcode: string
	brand?: string
	images?: string[]
	category?: {
		id: string
		name: string
	}
	price: {
		buy: number
		sell: number
		discount?: number
		currency: string
	}
	stock: {
		quantity: number
		minQuantity?: number
		unit?: string
	}
	tax?: {
		type: string
		value: number
	}
	supplier?: {
		id?: string
		name?: string
	}
	location?: {
		warehouse?: string
		shelf?: string
	}
	attributes?: {
		color?: string
		size?: string
		flavor?: string
		expiryDate?: string
		weight?: string
	}
	status: 'active' | 'inactive' | 'discontinued'
	description?: string
	createdBy: {
		_id: string
		displayName: string
		isInternal?: boolean
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

const ProductSchema: Schema<IProduct> = new mongoose.Schema(
	{
		productId: {
			type: String,
			required: [true, 'Product ID is required'],
			trim: true,
		},
		name: {
			type: String,
			required: [true, 'Product name is required'],
			trim: true,
			maxlength: [100, 'Name cannot exceed 100 characters'],
		},
		barcode: {
			type: String,
			required: [true, 'Barcode is required'],
		},
		brand: { type: String, trim: true },
		images: [{ type: String }],
		category: {
			id: { type: String },
			name: { type: String },
		},
		price: {
			buy: { type: Number, required: true, min: 0 },
			sell: { type: Number, required: true, min: 0 },
			discount: { type: Number, min: 0 },
			currency: { type: String, required: true, default: 'EUR' },
		},
		stock: {
			quantity: { type: Number, required: true, min: 0 },
			minQuantity: { type: Number, min: 0 },
			unit: { type: String, default: 'piece' },
		},
		tax: {
			type: { type: String },
			value: { type: Number, min: 0 },
		},
		supplier: {
			id: { type: String },
			name: { type: String },
		},
		location: {
			warehouse: { type: String },
			shelf: { type: String },
		},
		attributes: {
			color: { type: String },
			size: { type: String },
			flavor: { type: String },
			expiryDate: { type: String },
			weight: { type: String },
		},
		status: {
			type: String,
			enum: ['active', 'inactive', 'discontinued'],
			default: 'active',
		},
		description: {
			type: String,
			trim: true,
			maxlength: [500, 'Description cannot exceed 500 characters'],
		},
		createdBy: {
			_id: { type: String },
			displayName: { type: String },
			isInternal: { type: Boolean },
			createdAt: { type: Date },
		},
		updatedBy: {
			_id: { type: String },
			displayName: { type: String },
			updatedAt: { type: Date },
		},
	},
	{ timestamps: true },
)

tenantScopedSchema(ProductSchema)

ProductSchema.index({ tenantId: 1, productId: 1 }, { unique: true })
ProductSchema.index({ tenantId: 1, barcode: 1 }, { unique: true })

export const Product = mongoose.model<IProduct>('Products', ProductSchema)
