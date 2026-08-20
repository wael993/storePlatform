import mongoose, { Schema, Document } from 'mongoose'
import { tenantScopedSchema } from '../shared/mongodb/tenantScopedModel'

export interface IProduct extends Document {
	tenantId: string
	productId: string
	name: string
	latinName?: string
	barcode?: string
	internalCode?: string
	productFactoryCode?: string
	categoryId?: string
	supplierId?: string
	brandId?: string
	taxRate?: string
	unitId?: string
	price: {
		purchasePrice?: number
		retailPrice: number
		wholesalePrice?: number
		semiWholesalePrice?: number
		discount?: number
		currency: string
	}
	status: 'active' | 'inactive' | 'discontinued'
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
	description?: string
	aliases?: string[]
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

const ProductSchema: Schema<IProduct> = new mongoose.Schema(
	{
		productId: {
			type: String,
			required: true,
			trim: true,
		},
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
		latinName: {
			type: String,
			trim: true,
			maxlength: [100, 'Latin name cannot exceed 100 characters'],
		},
		categoryId: { type: String },
		brandId: { type: String },
		supplierId: { type: String },
		barcode: {
			type: String,
		},
		unitId: {
			type: String,
		},
		taxRate: { type: String },
		price: {
			type: {
				purchasePrice: { type: Number, min: 0 },
				wholesalePrice: { type: Number, min: 0 },
				retailPrice: { type: Number, required: true, min: 0 },
				semiWholesalePrice: { type: Number, min: 0 },
				discount: { type: Number, min: 0 },
				currency: { type: String, required: true, default: 'SYP' },
			},
			required: true,
		},
		status: {
			type: String,
			enum: ['active', 'inactive', 'discontinued'],
			default: 'active',
			required: true,
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
		aliases: [{ type: String, trim: true, maxlength: 100 }],
	},
	{ timestamps: true },
)

tenantScopedSchema(ProductSchema)

ProductSchema.index({ tenantId: 1, productId: 1 }, { unique: true })
ProductSchema.index({ tenantId: 1, name: 1 })
ProductSchema.index({ tenantId: 1, status: 1, name: 1 })
ProductSchema.index(
	{ tenantId: 1, barcode: 1 },
	{
		unique: true,
		partialFilterExpression: {
			barcode: { $exists: true, $type: 'string', $gt: '' },
		},
	},
)

export const Product = mongoose.model<IProduct>('Products', ProductSchema)
