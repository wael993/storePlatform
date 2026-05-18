import mongoose from 'mongoose'
import { config } from '../config/config'
import { Product } from '../models/Products'
import { Brand } from '../models/Brand'
import { Category } from '../models/Category'
import { Supplier } from '../models/Supplier'
import Tenant from '../models/Tenant'
import {
	DEFAULT_TENANT_DOMAIN,
	DEFAULT_TENANT_ID,
	DEFAULT_TENANT_NAME,
} from '../shared/tenant'
import { v4 as uuidv4 } from 'uuid'

const PRODUCT_NAMES = [
	'Wireless Mouse',
	'Mechanical Keyboard',
	'Gaming Headset',
	'USB-C Hub',
	'Portable SSD 1TB',
	'Webcam 1080p',
	'Bluetooth Speaker',
	'Noise Cancelling Earbuds',
	'Laptop Stand',
	'Monitor 27 inch',
	'Smartwatch Pro',
	'Router AX3000',
	'Smart Home Hub',
	'Action Camera',
	'Power Bank 20000mAh',
	'Wireless Charger',
	'LED Desk Lamp',
	'External DVD Drive',
	'Graphic Tablet',
	'Portable Projector',
	'Fitness Tracker',
	'VR Controller Set',
	'Streaming Microphone',
	'WiFi Repeater',
	'IP Security Camera',
	'Smart Plug Pack',
	'NAS Storage 2-Bay',
	'Travel Adapter',
	'Docking Station',
	'Barcode Scanner',
]

const UNITS: Array<'piece' | 'set' | 'kg' | 'meter' | 'mm'> = [
	'piece',
	'set',
	'piece',
	'piece',
	'kg',
	'piece',
	'meter',
	'piece',
	'mm',
	'piece',
]

function buildProducts(
	brandIds: string[],
	brandNames: string[],
	categoryIds: string[],
	categoryNames: string[],
	supplierIds: string[],
	supplierNames: string[],
) {
	return PRODUCT_NAMES.map((name, index) => {
		const idx = index + 1
		const wholesale = 8 + idx * 1.4
		const retailSale = Number((wholesale * 1.85).toFixed(2))
		const semiWholesaleSales = Number((wholesale * 1.45).toFixed(2))
		const buyCost = Number((wholesale * 1.15).toFixed(2))

		return {
			id: uuidv4(),
			productId: `PRD-${idx.toString().padStart(4, '0')}`,
			productFactoryCode: `FC-${idx.toString().padStart(3, '0')}`,
			name,
			barcode: `900000000${idx.toString().padStart(4, '0')}`,
			categoryId: categoryIds[index % categoryIds.length],
			categoryName: categoryNames[index % categoryNames.length],
			brandId: brandIds[index % brandIds.length],
			brandName: brandNames[index % brandNames.length],
			supplierId: supplierIds[index % supplierIds.length],
			supplierName: supplierNames[index % supplierNames.length],
			images: [],
			price: {
				wholesale: Number(wholesale.toFixed(2)),
				retailSale,
				semiWholesaleSales,
				buyCost,
				discount: Number((retailSale - 1.5).toFixed(2)),
				currency: 'EUR',
			},
			stock: {
				quantity: 40 + idx * 3,
				minQuantity: 8 + (idx % 6),
			},
			unit: UNITS[index % UNITS.length],
			tax: {
				type: 'VAT',
				value: 19,
			},
			location: {
				warehouse: `Warehouse ${((idx - 1) % 3) + 1}`,
				shelf: `${String.fromCharCode(65 + ((idx - 1) % 5))}-${10 + idx}`,
			},
			attributes: {
				color: ['Black', 'White', 'Gray', 'Blue'][index % 4],
				weight: `${80 + idx * 5}g`,
			},
			status: 'active' as const,
			description: `${name} - seeded demo product ${idx}`,
		}
	})
}

// To run this script: cd ../../admin-backend && ts-node src/scripts/create-initial-products.ts
async function createInitialProducts() {
	try {
		// Connect to MongoDB
		await mongoose.connect(config.mongoDB.connectionString, {
			dbName: config.mongoDB.databaseName,
		})
		console.log('Connected to MongoDB')

		await Tenant.updateOne(
			{ tenantId: DEFAULT_TENANT_ID },
			{
				$set: {
					name: DEFAULT_TENANT_NAME,
					domain: DEFAULT_TENANT_DOMAIN,
					status: 'active',
				},
			},
			{ upsert: true },
		)

		const [brands, categories, suppliers] = await Promise.all([
			Brand.find({ tenantId: DEFAULT_TENANT_ID }).sort({ name: 1 }).lean(),
			Category.find({ tenantId: DEFAULT_TENANT_ID }).sort({ name: 1 }).lean(),
			Supplier.find({ tenantId: DEFAULT_TENANT_ID }).sort({ name: 1 }).lean(),
		])

		if (!brands.length || !categories.length || !suppliers.length) {
			throw new Error(
				'Missing master data. Run npm run seed:master before seeding products.',
			)
		}

		const brandIds = brands.map(item => String(item._id))
		const brandNames = brands.map(item => item.name)
		const categoryIds = categories.map(item => String(item._id))
		const categoryNames = categories.map(item => item.name)
		const supplierIds = suppliers.map(item => String(item._id))
		const supplierNames = suppliers.map(item => item.name)
		const initialProducts = buildProducts(
			brandIds,
			brandNames,
			categoryIds,
			categoryNames,
			supplierIds,
			supplierNames,
		)

		// Delete existing products (targeted by productId)
		await Product.deleteMany({
			tenantId: DEFAULT_TENANT_ID,
			productId: { $in: initialProducts.map(p => p.productId) },
		} as any)
		console.log('Deleted existing matching products')

		const now = new Date()
		const documents = initialProducts.map(productData => ({
			id: productData.id,
			tenantId: DEFAULT_TENANT_ID,
			productId: productData.productId,
			productFactoryCode: productData.productFactoryCode,
			name: productData.name,
			barcode: productData.barcode,
			categoryId: productData.categoryId,
			categoryName: productData.categoryName,
			brandId: productData.brandId,
			brandName: productData.brandName,
			images: productData.images,
			price: productData.price,
			stock: productData.stock,
			unit: productData.unit,
			tax: productData.tax,
			supplierId: productData.supplierId,
			supplierName: productData.supplierName,
			location: productData.location,
			attributes: productData.attributes,
			status: productData.status,
			description: productData.description,
			createdBy: {
				_id: 'seed-script',
				displayName: 'Seed Script',
				createdAt: now,
			},
		}))

		await Product.insertMany(documents)
		console.log(`Created ${documents.length} products`)

		const seededProducts = await Product.find({
			tenantId: DEFAULT_TENANT_ID,
			productId: { $in: initialProducts.map(p => p.productId) },
		})
			.select({
				name: 1,
				productId: 1,
				brandName: 1,
				categoryName: 1,
				supplierName: 1,
				brandId: 1,
				categoryId: 1,
				supplierId: 1,
			})
			.sort({ productId: 1 })
			.lean()

		console.log('Seeded products:')
		for (const product of seededProducts) {
			console.log(
				`${product.productId} | ${product.name} | brand=${product.brandName} | category=${product.categoryName} | supplier=${product.supplierName}`,
			)
		}

		console.log(
			`All ${initialProducts.length} initial products seeded successfully`,
		)
	} catch (error) {
		console.error('Error creating initial products:', error)
		process.exit(1)
	} finally {
		await mongoose.disconnect()
		console.log('MongoDB disconnected')
	}
}

createInitialProducts()
