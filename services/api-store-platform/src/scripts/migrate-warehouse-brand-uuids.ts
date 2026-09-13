import assert from 'assert'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config/config'
import { Brand } from '../models/Brand'
import { BuyingInvoice } from '../models/BuyingInvoices'
import { Inventory } from '../models/Inventory'
import { Invoice } from '../models/Invoice'
import { Product } from '../models/Products'
import { SellingInvoiceItem } from '../models/SellingInvoices'
import { StockMoving } from '../models/StockMovings'
import Tenant from '../models/Tenant'
import { Warehouse } from '../models/Warehaus'
import { isUuidV4, UUID_V4 } from '../shared/uuid'

type WarehouseRow = {
	_id: mongoose.Types.ObjectId
	tenantId: string
	warehouseId: string
}

type BrandRow = {
	_id: mongoose.Types.ObjectId
	tenantId: string
	brandId?: string
}

const remapField = async (
	model: mongoose.Model<any>,
	tenantId: string,
	field: string,
	oldId: string,
	newId: string,
): Promise<number> => {
	const result = await model.updateMany(
		{ tenantId, [field]: oldId },
		{ $set: { [field]: newId } },
	)

	return result.modifiedCount
}

const migrateWarehousesForTenant = async (tenantId: string) => {
	const warehouses = await Warehouse.find({ tenantId }).lean<WarehouseRow[]>()
	let migrated = 0

	for (const warehouse of warehouses) {
		if (isUuidV4(warehouse.warehouseId)) {
			continue
		}

		const oldId = warehouse.warehouseId
		const newId = uuidv4()

		await Warehouse.updateOne(
			{ tenantId, _id: warehouse._id },
			{ $set: { warehouseId: newId } },
		)

		const refs = await Promise.all([
			remapField(Inventory, tenantId, 'warehouseId', oldId, newId),
			remapField(StockMoving, tenantId, 'warehouseId', oldId, newId),
			remapField(Invoice, tenantId, 'warehouseId', oldId, newId),
			remapField(BuyingInvoice, tenantId, 'warehouseId', oldId, newId),
			remapField(SellingInvoiceItem, tenantId, 'warehouseId', oldId, newId),
		])

		migrated += 1
		console.log(
			`warehouse tenant=${tenantId} ${oldId} -> ${newId} refs=${refs.reduce((a, b) => a + b, 0)}`,
		)
	}

	return migrated
}

const migrateBrandsForTenant = async (tenantId: string) => {
	const brands = await Brand.find({ tenantId }).lean<BrandRow[]>()
	let migrated = 0

	for (const brand of brands) {
		const mongoId = String(brand._id)
		const currentId = brand.brandId

		if (isUuidV4(currentId)) {
			continue
		}

		const newId = uuidv4()
		const oldIds = [
			...new Set([currentId, mongoId].filter(Boolean)),
		] as string[]

		await Brand.updateOne(
			{ tenantId, _id: brand._id },
			{ $set: { brandId: newId } },
		)

		let productRefs = 0

		for (const oldId of oldIds) {
			productRefs += await remapField(
				Product,
				tenantId,
				'brandId',
				oldId,
				newId,
			)
		}

		migrated += 1
		console.log(
			`brand tenant=${tenantId} ${oldIds.join('|')} -> ${newId} products=${productRefs}`,
		)
	}

	return migrated
}

async function migrateWarehouseAndBrandIds() {
	assert.equal(isUuidV4('550e8400-e29b-41d4-a716-446655440000'), true)
	assert.equal(isUuidV4('app-wh-main'), false)
	assert.equal(isUuidV4('الرئيسي'), false)

	await mongoose.connect(config.mongoDB.connectionString, {
		dbName: config.mongoDB.databaseName,
	})

	console.log(`Connected to MongoDB (${mongoose.connection.name})`)

	const tenants = await Tenant.find({}, { tenantId: 1 }).lean()
	let warehousesMigrated = 0
	let brandsMigrated = 0

	for (const tenant of tenants) {
		warehousesMigrated += await migrateWarehousesForTenant(tenant.tenantId)
		brandsMigrated += await migrateBrandsForTenant(tenant.tenantId)
	}

	const orphanBrands = await Brand.collection.deleteMany({
		$or: [
			{ tenantId: null },
			{ tenantId: { $exists: false } },
			{ tenantId: '' },
		],
	})

	console.log(`deleted orphan brands=${orphanBrands.deletedCount}`)

	// Backfill any remaining non-UUID brandId via collection (bypass tenant middleware)
	const leftoverBrands = await Brand.collection
		.find({
			tenantId: { $type: 'string' },
			$or: [
				{ brandId: { $exists: false } },
				{ brandId: null },
				{ brandId: '' },
				{ brandId: { $not: { $regex: UUID_V4.source, $options: 'i' } } },
			],
		})
		.toArray()

	for (const brand of leftoverBrands) {
		const tenantId = String(brand.tenantId)
		const mongoId = String(brand._id)
		const currentId =
			typeof brand.brandId === 'string' ? brand.brandId : undefined
		const newId = uuidv4()
		const oldIds = [
			...new Set([currentId, mongoId].filter(Boolean)),
		] as string[]

		await Brand.collection.updateOne(
			{ _id: brand._id },
			{ $set: { brandId: newId } },
		)

		let productRefs = 0

		for (const oldId of oldIds) {
			productRefs += await remapField(
				Product,
				tenantId,
				'brandId',
				oldId,
				newId,
			)
		}

		brandsMigrated += 1
		console.log(
			`brand leftover tenant=${tenantId} ${oldIds.join('|')} -> ${newId} products=${productRefs}`,
		)
	}

	// Drop old non-partial unique index if present so syncIndexes can recreate cleanly
	try {
		await Brand.collection.dropIndex('tenantId_1_brandId_1')
	} catch {
		// index may not exist yet
	}

	await Warehouse.syncIndexes()
	await Brand.syncIndexes()
	await Inventory.syncIndexes()
	await StockMoving.syncIndexes()
	await Invoice.syncIndexes()
	await BuyingInvoice.syncIndexes()

	console.log(`Done. warehouses=${warehousesMigrated} brands=${brandsMigrated}`)
}

migrateWarehouseAndBrandIds()
	.catch(error => {
		console.error('Migration failed', error)
		process.exitCode = 1
	})
	.finally(async () => {
		await mongoose.disconnect()
	})
