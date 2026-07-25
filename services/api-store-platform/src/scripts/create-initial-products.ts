import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config/config'
import { Product } from '../models/Products'
import { Category } from '../models/Category'
import { Inventory } from '../models/Inventory'
import { Unit } from '../models/Unit'
import { Warehouse } from '../models/Warehaus'
import Tenant from '../models/Tenant'
import { INITIAL_PRODUCTS_DATA } from './initial-products-data'

const TENANT_ID = 'zobani-car'
const WAREHOUSE_NAME = 'الرئيسي'
const DEFAULT_UNIT_NAME = 'قطعة'
const SEED_USER = {
	_id: 'seed-script',
	displayName: 'Seed Script',
	createdAt: new Date(),
}

async function resolveUnitIds(
	unitNames: string[],
): Promise<Map<string, string>> {
	const existing = await Unit.find({
		tenantId: TENANT_ID,
		name: { $in: unitNames },
	}).lean()

	const unitIdsByName = new Map(existing.map(unit => [unit.name, unit.unitId]))
	const missing = unitNames.filter(name => !unitIdsByName.has(name))

	if (missing.length > 0) {
		const created = await Unit.insertMany(
			missing.map(name => ({
				tenantId: TENANT_ID,
				unitId: uuidv4(),
				name,
				internalCode: name.toUpperCase(),
				createdBy: SEED_USER,
			})),
		)

		for (const unit of created) {
			unitIdsByName.set(unit.name, unit.unitId)
		}
	}

	return unitIdsByName
}

async function createInitialProducts() {
	try {
		await mongoose.connect(config.mongoDB.connectionString, {
			dbName: config.mongoDB.databaseName,
		})

		console.log('Connected to MongoDB')

		const [tenant, warehouse] = await Promise.all([
			Tenant.findOne({ tenantId: TENANT_ID }).lean(),
			Warehouse.findOne({
				tenantId: TENANT_ID,
				name: WAREHOUSE_NAME,
			}).lean(),
		])

		if (!tenant) {
			throw new Error(`Tenant "${TENANT_ID}" was not found`)
		}

		if (!warehouse) {
			throw new Error(
				`Warehouse "${WAREHOUSE_NAME}" was not found for tenant "${TENANT_ID}"`,
			)
		}

		const categoryNames = [
			...new Set(INITIAL_PRODUCTS_DATA.map(product => product.category)),
		]
		const unitNames = [
			...new Set(
				INITIAL_PRODUCTS_DATA.map(
					product => product.unitName || DEFAULT_UNIT_NAME,
				),
			),
		]

		await Category.bulkWrite(
			categoryNames.map((name, index) => ({
				updateOne: {
					filter: { tenantId: TENANT_ID, name },
					update: {
						$setOnInsert: {
							tenantId: TENANT_ID,
							categoryId: `${TENANT_ID}-inventory-category-${index + 1}`,
							name,
							createdBy: SEED_USER,
						},
					},
					upsert: true,
				},
			})),
		)

		const categories = await Category.find({
			tenantId: TENANT_ID,
			name: { $in: categoryNames },
		}).lean()
		const categoryIdsByName = new Map(
			categories.map(category => [category.name, category.categoryId]),
		)
		const unitIdsByName = await resolveUnitIds(unitNames)

		const products = INITIAL_PRODUCTS_DATA.map((product, index) => {
			const productId = `${TENANT_ID}-inventory-product-${index + 1}`
			const categoryId = categoryIdsByName.get(product.category)
			const unitName = product.unitName || DEFAULT_UNIT_NAME
			const unitId = unitIdsByName.get(unitName)

			if (!categoryId) {
				throw new Error(`Category "${product.category}" could not be resolved`)
			}

			if (!unitId) {
				throw new Error(`Unit "${unitName}" could not be resolved`)
			}

			return { ...product, productId, categoryId, unitId }
		})

		await Product.insertMany(
			products.map(product => ({
				tenantId: TENANT_ID,
				productId: product.productId,
				name: product.name,
				unitId: product.unitId,
				categoryId: product.categoryId,
				productFactoryCode: product.productFactoryCode,
				internalCode: product.internalCode,
				...(product.barcode && { barcode: product.barcode }),
				price: {
					purchasePrice: product.purchasePrice,
					retailPrice: product.retailPrice,
					currency: 'USD',
				},
				images: [],
				status: 'active' as const,
				createdBy: SEED_USER,
			})),
		)

		await Inventory.bulkWrite(
			products.map((product, index) => ({
				updateOne: {
					filter: { tenantId: TENANT_ID, productId: product.productId },
					update: {
						$set: {
							tenantId: TENANT_ID,
							warehouseId: warehouse.warehouseId,
							quantity: product.quantity,
							reservedQuantity: 0,
							availableQuantity: product.quantity,
						},
						$setOnInsert: {
							inventoryId: `${TENANT_ID}-inventory-${index + 1}`,
							createdBy: SEED_USER,
						},
					},
					upsert: true,
				},
			})),
		)

		console.log(
			`Seeded ${products.length} products in ${categoryNames.length} categories with ${unitNames.length} units; inventory assigned to "${WAREHOUSE_NAME}"`,
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
