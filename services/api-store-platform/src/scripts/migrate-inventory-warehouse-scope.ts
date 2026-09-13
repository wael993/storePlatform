import assert from 'assert'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config/config'
import { BuyingInvoice } from '../models/BuyingInvoices'
import { DailyAction } from '../models/DailyAction'
import { Inventory } from '../models/Inventory'
import { Invoice } from '../models/Invoice'
import { StockMoving } from '../models/StockMovings'
import Tenant from '../models/Tenant'
import User from '../models/User'
import { Warehouse } from '../models/Warehaus'
import { isUuidV4 } from '../shared/uuid'

/** Tiny pure check for migration self-test (no mongoose). */
const requireWarehouseIdShape = (warehouseId?: string | null): string => {
	const id = warehouseId?.trim()

	if (!id) {
		throw new Error('warehouseId is required.')
	}

	return id
}

const missingWarehouseFilter = {
	$or: [
		{ warehouseId: { $exists: false } },
		{ warehouseId: null },
		{ warehouseId: '' },
	],
}

const resolveDefaultWarehouseId = async (tenantId: string): Promise<string> => {
	// note: Warehouse has no timestamps; _id order is the only stable "oldest first".
	const existing = await Warehouse.collection.findOne(
		{ tenantId },
		{ sort: { _id: 1 } },
	)

	if (typeof existing?.warehouseId === 'string' && existing.warehouseId) {
		return existing.warehouseId
	}

	const warehouseId = uuidv4()

	await Warehouse.collection.insertOne({
		tenantId,
		warehouseId,
		name: 'Main',
		status: 'active',
		createdBy: {
			_id: 'migration',
			displayName: 'migration',
			createdAt: new Date(),
		},
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	console.log(`created default warehouse tenant=${tenantId} id=${warehouseId}`)

	return warehouseId
}

const backfillInventory = async (
	tenantId: string,
	defaultWarehouseId: string,
): Promise<number> => {
	const result = await Inventory.collection.updateMany(
		{ tenantId, ...missingWarehouseFilter },
		{ $set: { warehouseId: defaultWarehouseId } },
	)

	return result.modifiedCount
}

const warehouseIdByInvoiceNumber = async (
	tenantId: string,
): Promise<Map<string, string>> => {
	const byNumber = new Map<string, string>()

	for (const collection of [
		Invoice.collection,
		BuyingInvoice.collection,
	] as const) {
		const rows = await collection
			.find({
				tenantId,
				warehouseId: { $exists: true, $nin: [null, ''] },
				invoiceNumber: { $exists: true, $nin: [null, ''] },
			})
			.project({ invoiceNumber: 1, warehouseId: 1 })
			.toArray()

		for (const row of rows) {
			const invoiceNumber =
				typeof row.invoiceNumber === 'string' ? row.invoiceNumber.trim() : ''
			const warehouseId =
				typeof row.warehouseId === 'string' ? row.warehouseId.trim() : ''

			if (invoiceNumber && warehouseId && !byNumber.has(invoiceNumber)) {
				byNumber.set(invoiceNumber, warehouseId)
			}
		}
	}

	return byNumber
}

const backfillDailyActions = async (
	tenantId: string,
	defaultWarehouseId: string,
): Promise<number> => {
	const byInvoiceNumber = await warehouseIdByInvoiceNumber(tenantId)
	const rows = await DailyAction.collection
		.find({ tenantId, ...missingWarehouseFilter })
		.project({ invoiceNumber: 1 })
		.toArray()

	let updated = 0

	for (const row of rows) {
		const invoiceNumber =
			typeof row.invoiceNumber === 'string' ? row.invoiceNumber.trim() : ''
		const warehouseId =
			(invoiceNumber && byInvoiceNumber.get(invoiceNumber)) ||
			defaultWarehouseId

		await DailyAction.collection.updateOne(
			{ _id: row._id },
			{ $set: { warehouseId } },
		)

		updated += 1
	}

	return updated
}

const backfillInvoices = async (
	tenantId: string,
	defaultWarehouseId: string,
	collection: typeof Invoice.collection | typeof BuyingInvoice.collection,
	idField: 'invoiceId' | 'buyingInvoiceId',
	referenceType: 'selling_invoice' | 'buying_invoice',
): Promise<number> => {
	const rows = await collection
		.find({ tenantId, ...missingWarehouseFilter })
		.project({ [idField]: 1 })
		.toArray()

	let updated = 0

	for (const row of rows) {
		const referenceId =
			typeof row[idField] === 'string' ? (row[idField] as string) : undefined
		let warehouseId = defaultWarehouseId

		if (referenceId) {
			const moving = await StockMoving.collection.findOne(
				{
					tenantId,
					referenceType,
					referenceId,
					warehouseId: { $exists: true, $nin: [null, ''] },
				},
				{ projection: { warehouseId: 1 } },
			)

			if (typeof moving?.warehouseId === 'string' && moving.warehouseId) {
				warehouseId = moving.warehouseId
			}
		}

		await collection.updateOne({ _id: row._id }, { $set: { warehouseId } })
		updated += 1
	}

	return updated
}

const warehouseIdFromReference = async (
	tenantId: string,
	referenceType: string | undefined,
	referenceId: string | undefined,
): Promise<string | null> => {
	if (!referenceId) {
		return null
	}

	if (referenceType === 'selling_invoice') {
		const invoice = await Invoice.collection.findOne(
			{ tenantId, invoiceId: referenceId },
			{ projection: { warehouseId: 1 } },
		)

		return typeof invoice?.warehouseId === 'string'
			? invoice.warehouseId.trim() || null
			: null
	}

	if (referenceType === 'buying_invoice') {
		const invoice = await BuyingInvoice.collection.findOne(
			{ tenantId, buyingInvoiceId: referenceId },
			{ projection: { warehouseId: 1 } },
		)

		return typeof invoice?.warehouseId === 'string'
			? invoice.warehouseId.trim() || null
			: null
	}

	return null
}

const backfillStockMovings = async (
	tenantId: string,
	defaultWarehouseId: string,
): Promise<number> => {
	const rows = await StockMoving.collection
		.find({ tenantId, ...missingWarehouseFilter })
		.project({ referenceType: 1, referenceId: 1 })
		.toArray()

	let updated = 0

	for (const row of rows) {
		const fromRef = await warehouseIdFromReference(
			tenantId,
			typeof row.referenceType === 'string' ? row.referenceType : undefined,
			typeof row.referenceId === 'string' ? row.referenceId : undefined,
		)
		const warehouseId = fromRef || defaultWarehouseId

		await StockMoving.collection.updateOne(
			{ _id: row._id },
			{ $set: { warehouseId } },
		)

		updated += 1
	}

	return updated
}

/**
 * Non-owner roles read their warehouse ACL from `User.warehouseIds`; a missing
 * field means "no warehouse access", so existing staff must be granted every
 * tenant warehouse to keep the pre-warehouse behaviour they had.
 */
const backfillUserWarehouseIds = async (tenantId: string): Promise<number> => {
	const warehouses = await Warehouse.collection
		.find({ tenantId })
		.project({ warehouseId: 1 })
		.toArray()

	const warehouseIds = warehouses
		.map(warehouse => warehouse.warehouseId)
		.filter((id): id is string => typeof id === 'string' && Boolean(id))

	if (warehouseIds.length === 0) {
		return 0
	}

	const result = await User.collection.updateMany(
		{
			tenantId,
			role: { $nin: ['owner', 'super_admin'] },
			$or: [{ warehouseIds: { $exists: false } }, { warehouseIds: null }],
		},
		{ $set: { warehouseIds } },
	)

	return result.modifiedCount
}

const rebuildInventoryIndexes = async (): Promise<void> => {
	const collection = Inventory.collection
	const indexes = await collection.indexes()
	const oldUnique = indexes.find(
		index =>
			index.unique === true &&
			index.key?.tenantId === 1 &&
			index.key?.productId === 1 &&
			index.key?.warehouseId === undefined,
	)

	if (oldUnique?.name) {
		await collection.dropIndex(oldUnique.name)
		console.log(`dropped inventory index ${oldUnique.name}`)
	}

	await collection.createIndex(
		{ tenantId: 1, warehouseId: 1, productId: 1 },
		{ unique: true, name: 'tenantId_1_warehouseId_1_productId_1' },
	)

	await collection.createIndex({ tenantId: 1, warehouseId: 1 })
	await collection.createIndex({ tenantId: 1, productId: 1 })
	console.log('ensured inventory warehouse-scoped indexes')
}

async function migrateInventoryWarehouseScope() {
	assert.equal(isUuidV4('550e8400-e29b-41d4-a716-446655440000'), true)
	assert.equal(requireWarehouseIdShape('  wh-1  '), 'wh-1')

	await mongoose.connect(config.mongoDB.connectionString, {
		dbName: config.mongoDB.databaseName,
	})

	console.log(`Connected to MongoDB (${mongoose.connection.name})`)

	const tenants = await Tenant.find({}, { tenantId: 1 }).lean()
	const tenantIds = new Set(
		tenants.map(tenant => tenant.tenantId).filter(Boolean),
	)

	for (const collection of [
		Inventory.collection,
		StockMoving.collection,
		Warehouse.collection,
		Invoice.collection,
		BuyingInvoice.collection,
		DailyAction.collection,
		User.collection,
	]) {
		const ids = await collection.distinct('tenantId')

		for (const id of ids) {
			if (typeof id === 'string' && id.trim()) {
				tenantIds.add(id)
			}
		}
	}

	let inventoryUpdated = 0
	let stockMovingUpdated = 0
	let sellingInvoiceUpdated = 0
	let buyingInvoiceUpdated = 0
	let dailyActionUpdated = 0
	let userAclUpdated = 0

	for (const tenantId of tenantIds) {
		const defaultWarehouseId = await resolveDefaultWarehouseId(tenantId)

		inventoryUpdated += await backfillInventory(tenantId, defaultWarehouseId)

		sellingInvoiceUpdated += await backfillInvoices(
			tenantId,
			defaultWarehouseId,
			Invoice.collection,
			'invoiceId',
			'selling_invoice',
		)

		buyingInvoiceUpdated += await backfillInvoices(
			tenantId,
			defaultWarehouseId,
			BuyingInvoice.collection,
			'buyingInvoiceId',
			'buying_invoice',
		)

		stockMovingUpdated += await backfillStockMovings(
			tenantId,
			defaultWarehouseId,
		)

		dailyActionUpdated += await backfillDailyActions(
			tenantId,
			defaultWarehouseId,
		)

		userAclUpdated += await backfillUserWarehouseIds(tenantId)
	}

	await rebuildInventoryIndexes()

	const remainingInventory = await Inventory.collection.countDocuments(
		missingWarehouseFilter,
	)
	const remainingMovings = await StockMoving.collection.countDocuments(
		missingWarehouseFilter,
	)
	const remainingSelling = await Invoice.collection.countDocuments(
		missingWarehouseFilter,
	)
	const remainingBuying = await BuyingInvoice.collection.countDocuments(
		missingWarehouseFilter,
	)
	const remainingDailyActions = await DailyAction.collection.countDocuments(
		missingWarehouseFilter,
	)

	const usersWithoutAcl = await User.collection.countDocuments({
		role: { $nin: ['owner', 'super_admin'] },
		$or: [{ warehouseIds: { $exists: false } }, { warehouseIds: null }],
	})

	assert.equal(remainingInventory, 0)
	assert.equal(remainingMovings, 0)
	assert.equal(remainingSelling, 0)
	assert.equal(remainingBuying, 0)
	assert.equal(remainingDailyActions, 0)
	assert.equal(usersWithoutAcl, 0)

	console.log(
		`done inventoryBackfill=${inventoryUpdated} stockMovingBackfill=${stockMovingUpdated} sellingInvoiceBackfill=${sellingInvoiceUpdated} buyingInvoiceBackfill=${buyingInvoiceUpdated} dailyActionBackfill=${dailyActionUpdated} userAclBackfill=${userAclUpdated}`,
	)

	await mongoose.disconnect()
}

migrateInventoryWarehouseScope().catch(error => {
	console.error(error)
	process.exit(1)
})
