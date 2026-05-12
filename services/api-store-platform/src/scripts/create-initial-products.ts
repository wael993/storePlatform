import mongoose from 'mongoose'
import { config } from '../config/config'
import { Product } from '../models/Products'
import Tenant from '../models/Tenant'
import {
	DEFAULT_TENANT_DOMAIN,
	DEFAULT_TENANT_ID,
	DEFAULT_TENANT_NAME,
} from '../shared/tenant'

// Initial products data
const INITIAL_PRODUCTS = [
	{
		productId: '321654987352',
		name: 'Wireless Mouse',
		barcode: '123456789012311',
		brand: 'TechBrand',
		images: [],
		category: {
			id: 'cat-001',
			name: 'Electronics',
		},
		price: {
			buy: 10.0,
			sell: 19.99,
			discount: 17.99,
			currency: 'EUR',
		},
		stock: {
			quantity: 150,
			minQuantity: 10,
			unit: 'piece',
		},
		tax: {
			type: 'VAT',
			value: 19,
		},
		supplier: {
			id: 'sup-001',
			name: 'ABC Supplier',
		},
		location: {
			warehouse: 'Main Warehouse',
			shelf: 'A-12',
		},
		attributes: {
			color: 'Black',
			weight: '95g',
		},
		status: 'active' as const,
		description: 'Ergonomic wireless mouse with USB receiver',
	},
]

// To run this script: cd ../../admin-backend && ts-node src/scripts/create-initial-products.ts
async function createInitialProducts() {
	try {
		// Connect to MongoDB
		await mongoose.connect(config.mongoDB.connectionString)
		console.log('✅ Connected to MongoDB')

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

		// Delete existing products (targeted by productId)
		await Product.deleteMany({
			tenantId: DEFAULT_TENANT_ID,
			productId: { $in: INITIAL_PRODUCTS.map(p => p.productId) },
		} as any)
		console.log('🗑️  Existing matching products deleted (Products collection)')

		// Create initial products
		for (const productData of INITIAL_PRODUCTS) {
			const now = new Date()
			// Create product document
			const product = new Product({
				tenantId: DEFAULT_TENANT_ID,
				productId: productData.productId,
				name: productData.name,
				barcode: productData.barcode,
				brand: productData.brand,
				images: productData.images,
				category: productData.category,
				price: productData.price,
				stock: productData.stock,
				tax: productData.tax,
				supplier: productData.supplier,
				location: productData.location,
				attributes: productData.attributes,
				status: productData.status,
				description: productData.description,
				createdBy: {
					_id: 'seed-script',
					displayName: 'Seed Script',
					// isInternal: true,
					createdAt: now,
				},
			})

			await product.save()
			console.log(`✅ Product created: ${product.name}`)
			console.log('🆔 ProductId:', product.productId)
			console.log('💰 Sell Price: €' + product.price.sell)
			console.log('📱 Barcode:', product.barcode)
			console.log('📊 Quantity:', product.stock.quantity)
			console.log('─'.repeat(60))
		}

		console.log(
			`🎉 All ${INITIAL_PRODUCTS.length} initial products seeded successfully!`,
		)
	} catch (error) {
		console.error('❌ Error creating initial products:', error)
		process.exit(1)
	} finally {
		await mongoose.disconnect()
		console.log('🔌 MongoDB disconnected')
	}
}

createInitialProducts()
