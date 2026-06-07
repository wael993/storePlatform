import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IProduct extends Document {
	tenantId: string
	_id: string
	productId?: string
	internalCode?: string
	productFactoryCode?: string
	name: string
	categoryId?: string
	categoryName?: string
	brandId?: string
	brandName?: string
	barcode: string
	stock: {
		quantity: number
		minQuantity?: number
	}
	unit?: 'kg' | 'piece' | 'meter' | 'set' | 'mm'
	tax?: {
		type: string
		value: number
	}
	supplierId?: string
	supplierName?: string
	price: {
		wholesale: number
		retailSale: number
		semiWholesaleSales: number
		buyCost: number
		discount?: number
		currency: string
	}
	location?: {
		warehouse?: string
		shelf?: string
	}
	status: 'active' | 'inactive' | 'discontinued'
	description?: string
	attributes?: {
		color?: string
		size?: string
		weight?: string
		length?: string
		width?: string
		height?: string
		flavor?: string
		expiryDate?: string
	}
	images?: string[]
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

const ProductSchema: Schema<IProduct> = new mongoose.Schema(
	{
		_id: { type: String, required: [true, 'ID is required'], trim: true },
		productId: { type: String, trim: true },
		internalCode: {
			type: String,
			trim: true,
			index: true,
			uppercase: true,
		},
		productFactoryCode: {
			type: String,
			trim: true,
		},
		name: {
			type: String,
			required: [true, 'Product name is required'],
			trim: true,
			maxlength: [100, 'Name cannot exceed 100 characters'],
		},
		categoryId: { type: String },
		categoryName: { type: String },
		brandId: { type: String },
		brandName: { type: String },
		supplierId: { type: String },
		supplierName: { type: String },
		barcode: {
			type: String,
			required: [true, 'Barcode is required'],
		},
		stock: {
			quantity: { type: Number, required: true, min: 0 },
			minQuantity: { type: Number, min: 0 },
		},
		unit: {
			type: String,
			enum: ['kg', 'piece', 'meter', 'set', 'mm'],
			default: 'piece',
		},
		tax: {
			type: { type: String },
			value: { type: Number, min: 0 },
		},
		price: {
			wholesale: { type: Number, required: true, min: 0 },
			retailSale: { type: Number, required: true, min: 0 },
			semiWholesaleSales: { type: Number, min: 0 },
			buyCost: { type: Number, required: true, min: 0 },
			discount: { type: Number, min: 0 },
			currency: { type: String, required: true, default: 'EUR' },
		},
		location: {
			warehouse: { type: String },
			shelf: { type: String },
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
		attributes: {
			color: { type: String },
			size: { type: String },
			weight: { type: String },
			length: { type: String },
			width: { type: String },
			height: { type: String },
			flavor: { type: String },
			expiryDate: { type: String },
		},
		images: [{ type: String }],
		createdBy: {
			_id: { type: String },
			displayName: { type: String },
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

ProductSchema.index({ tenantId: 1, _id: 1 }, { unique: true })
ProductSchema.index({ tenantId: 1, barcode: 1 }, { unique: true })

export const Product = mongoose.model<IProduct>('Products', ProductSchema)
