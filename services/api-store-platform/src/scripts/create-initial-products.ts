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
	// 'Wireless Mouse',
	// 'Mechanical Keyboard',
	// 'Gaming Headset',
	// 'USB-C Hub',
	// 'Portable SSD 1TB',
	// 'Webcam 1080p',
	// 'Bluetooth Speaker',
	// 'Noise Cancelling Earbuds',
	// 'Laptop Stand',
	// 'Monitor 27 inch',
	// 'Smartwatch Pro',
	// 'Router AX3000',
	// 'Smart Home Hub',
	// 'Action Camera',
	// 'Power Bank 20000mAh',
	// 'Wireless Charger',
	// 'LED Desk Lamp',
	// 'External DVD Drive',
	// 'Graphic Tablet',
	// 'Portable Projector',
	// 'Fitness Tracker',
	// 'VR Controller Set',
	// 'Streaming Microphone',
	// 'WiFi Repeater',
	// 'IP Security Camera',
	// 'Smart Plug Pack',
	// 'NAS Storage 2-Bay',
	// 'Travel Adapter',
	// 'Docking Station',
	// 'Barcode Scanner',

	'ابوشوكة اخضر',
	'ملون',
	'ابو شوكة',
	'اسطنبولي',
	'اسطنبولي ناعم',
	'قيسي',
	'نبالي',
	'ابوشوكة اسود',
	'رمان',
	'نبالي اخضر',
	'خيار 0',
	'خيار 1',
	'خيار 2',
	'خيار قطاعة',
]

const UNITS: Array<'piece' | 'set' | 'kg' | 'meter' | 'mm'> = [
	// 'piece',
	// 'set',
	// 'piece',
	// 'piece',
	'kg',
	// 'piece',
	// 'meter',
	// 'piece',
	// 'mm',
	// 'piece',
]

function buildProducts(
	brandIds: string[],
	categoryIds: string[],
	supplierIds: string[],
) {
	return PRODUCT_NAMES.map((name, index) => {
		const idx = index + 1
		const wholesale = 8 + idx * 1.4
		const retailPrice = Number((wholesale * 1.85).toFixed(2))
		const semiWholesalePrice = Number((wholesale * 1.45).toFixed(2))
		const purchasePrice = Number((wholesale * 1.15).toFixed(2))

		return {
			productFactoryCode: `FC-${idx.toString().padStart(3, '0')}`,
			internalCode: `IC-${idx.toString().padStart(3, '0')}`,
			productId: uuidv4(),
			name,
			barcode: `900000000${idx.toString().padStart(4, '0')}`,
			categoryId: categoryIds[index % categoryIds.length],
			brandId: brandIds[index % brandIds.length],
			supplierId: supplierIds[index % supplierIds.length],
			images: [],
			price: {
				wholesalePrice: Number(wholesale.toFixed(2)),
				retailPrice,
				semiWholesalePrice,
				purchasePrice,
				discount: Number((retailPrice - 1.5).toFixed(2)),
				currency: 'EUR',
			},
			unitId: UNITS[index % UNITS.length],
			taxRate: '0',
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
		const categoryIds = categories.map(item =>
			String(item.categoryId ?? item._id),
		)
		const supplierIds = suppliers.map(item =>
			String(item.supplierId ?? item._id),
		)
		const initialProducts = buildProducts(brandIds, categoryIds, supplierIds)

		await Product.deleteMany({
			tenantId: DEFAULT_TENANT_ID,
			productId: { $in: initialProducts.map(p => p.productId) },
		} as any)

		console.log('Deleted existing matching products')

		const now = new Date()
		const documents = initialProducts.map(productData => ({
			tenantId: DEFAULT_TENANT_ID,
			...productData,
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
				brandId: 1,
				categoryId: 1,
				supplierId: 1,
			})
			.sort({ name: 1 })
			.lean()

		console.log('Seeded products:')
		for (const product of seededProducts) {
			console.log(
				`${product.productId} | ${product.name} | brand=${product.brandId} | category=${product.categoryId} | supplier=${product.supplierId}`,
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
