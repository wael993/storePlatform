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
		productId: '32165498735',
		id: 'p001',
		name: 'Wireless Mouse',
		price: 19.99,
		barcode: '12345678901231',
		count: 150,
		description: 'nothing',
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

		// Delete existing products (targeted by id)
		await Product.deleteMany({
			tenantId: DEFAULT_TENANT_ID,
			id: { $in: INITIAL_PRODUCTS.map(p => p.id) },
		} as any)
		console.log('🗑️  Existing matching products deleted (Products collection)')

		// Create initial products
		for (const productData of INITIAL_PRODUCTS) {
			// Create product document
			const product = new Product({
				tenantId: DEFAULT_TENANT_ID,
				productId: productData.productId,
				id: productData.id,
				name: productData.name,
				price: productData.price,
				barcode: productData.barcode,
				count: productData.count,
				createdBy: {
					_id: 'seed-script',
					displayName: 'Seed Script',
					isInternal: true,
				},
				description: productData.description,
			})

			await product.save()
			console.log(`✅ Product created: ${product.name}`)
			console.log('🆔 ID:', product.id)
			console.log('💰 Price: $' + product.price)
			console.log('📱 Barcode:', product.barcode)
			console.log('📊 Quantity:', product.count)
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
