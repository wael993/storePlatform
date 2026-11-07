import { randomUUID } from 'crypto'
import mongoose from 'mongoose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { closeDb, getDb } from '../db'
import { Doc, MapResult, mapDocs, SPECS } from '../db/etl/mongoToPg'
import { normalize } from '../db/etl/compare'
import { pgFind, pgUpdateMany } from '../db/mongoQuery'
import { DailyAction } from '../models/DailyAction'
import { Invoice } from '../models/Invoice'
import { Supplier } from '../models/Supplier'
import { Product } from '../models/Products'
import { Customer } from '../models/Customer'

/**
 * Differential check: the same documents in a real Mongo and (via the ETL
 * mapping) in Postgres; every filter must return the same documents in the
 * same order. Needs DATABASE_URL and MONGO_TEST_URL (a throwaway mongod).
 */
const enabled = Boolean(process.env.DATABASE_URL && process.env.MONGO_TEST_URL)
const tenantId = `t-${randomUUID()}`
const at = (day: number) => new Date(Date.UTC(2026, 0, day))

const FIXTURES: Record<string, Doc[]> = {
	DailyAction: [
		{
			actionId: 'a1',
			entryType: 'RECEIPT_ENTRY',
			customerId: 'c1',
			customerName: 'Ali',
			invoiceDate: at(1),
			exchangeRateToPrimary: 1,
		},
		{
			actionId: 'a2',
			entryType: 'PAYMENT_ENTRY',
			supplierId: 's1',
			supplierName: 'beta',
			invoiceDate: at(3),
			exchangeRateToPrimary: 2.5,
		},
		{
			actionId: 'a3',
			entryType: 'EXPENSE_ENTRY',
			invoiceDate: at(2),
			note: null,
		},
		{
			actionId: 'a4',
			entryType: 'RECEIPT_ENTRY',
			customerId: 'c2',
			customerName: 'ALINA',
		},
		{
			actionId: 'a5',
			entryType: 'OTHER_COST',
			customerId: null,
			invoiceDate: at(3),
			exchangeRateToPrimary: 0.5,
		},
	],
	Products: [
		{
			productId: 'pr1',
			name: 'Tea',
			status: 'active',
			price: { retailPrice: 5, purchasePrice: 3, currency: 'USD' },
		},
		{
			productId: 'pr2',
			name: 'pot',
			status: 'active',
			price: { retailPrice: 2, purchasePrice: 4, currency: 'SYP' },
		},
		{
			productId: 'pr3',
			name: 'Pot',
			status: 'inactive',
			price: { retailPrice: 9, currency: 'USD' },
		},
	],
	Customer: [
		{
			customerId: 'cu1',
			name: 'Ali',
			openingBalances: [
				{
					currencyId: 'usd',
					currencyCode: 'USD',
					amount: 10,
					direction: 'owed_to_us',
				},
			],
		},
		{
			customerId: 'cu2',
			name: 'Bea',
			openingBalances: [
				{
					currencyId: 'syp',
					currencyCode: 'SYP',
					amount: 5,
					direction: 'we_owe',
				},
			],
		},
		{ customerId: 'cu3', name: 'Cem' },
	],
	Supplier: [
		{ supplierId: 's1', name: 'One', aliases: ['x', 'y'] },
		{ supplierId: 's2', name: 'Two', aliases: [] },
		{ supplierId: 's3', name: 'Three' },
	],
	Invoice: [
		{
			invoiceId: 'i1',
			status: 'paid',
			items: [{ productId: 'p1', name: 'P1', quantity: 1, unitPrice: 2 }],
			currencyAmounts: [],
			tenders: [
				{
					currencyId: 'usd',
					tenderedAmount: 5,
					appliedAmount: 5,
					changeAmount: 0,
				},
			],
		},
		{
			invoiceId: 'i2',
			status: 'draft',
			items: [{ productId: 'p2', name: 'P2', quantity: 1, unitPrice: 2 }],
			currencyAmounts: [],
		},
		{ invoiceId: 'i3', items: [], currencyAmounts: [] },
	],
}

const CASES: Array<{
	model: string
	filter: Doc
	sort?: Doc
	select?: string
}> = [
	{ model: 'DailyAction', filter: {}, sort: { invoiceDate: -1 } },
	{ model: 'DailyAction', filter: {}, sort: { invoiceDate: 1 } },
	{ model: 'DailyAction', filter: { customerId: null } },
	{ model: 'DailyAction', filter: { customerId: { $ne: 'c1' } } },
	{ model: 'DailyAction', filter: { customerId: { $in: ['c1', null] } } },
	{ model: 'DailyAction', filter: { customerId: { $nin: ['c1'] } } },
	{ model: 'DailyAction', filter: { supplierId: { $exists: true } } },
	{ model: 'DailyAction', filter: { supplierId: { $exists: false } } },
	{
		model: 'DailyAction',
		filter: { invoiceDate: { $gte: at(2), $lte: at(3) } },
	},
	{ model: 'DailyAction', filter: { exchangeRateToPrimary: { $gt: 0.5 } } },
	{ model: 'DailyAction', filter: { entryType: { $in: [] } } },
	{ model: 'DailyAction', filter: { entryType: { $nin: [] } } },
	{
		model: 'DailyAction',
		filter: { $or: [{ customerId: 'c1' }, { supplierId: 's1' }] },
	},
	{ model: 'DailyAction', filter: { $nor: [{ entryType: 'RECEIPT_ENTRY' }] } },
	{
		model: 'DailyAction',
		filter: { customerName: { $regex: '^ali', $options: 'i' } },
	},
	{
		model: 'DailyAction',
		filter: { 'createdBy._id': 'u-1' },
		select: 'actionId customerName',
	},
	{
		model: 'Products',
		filter: { 'price.retailPrice': { $gte: 5 } },
		sort: { 'price.retailPrice': -1 },
	},
	{ model: 'Products', filter: { 'price.purchasePrice': { $exists: false } } },
	{ model: 'Products', filter: { 'price.currency': 'USD', status: 'active' } },
	// byte order like Mongo: 'Pot' < 'Tea' < 'pot' (language order would put 'pot' first)
	{ model: 'Products', filter: {}, sort: { name: 1 } },
	{ model: 'Products', filter: {}, sort: { name: -1 } },
	{ model: 'Customer', filter: { 'openingBalances.direction': 'we_owe' } },
	{
		model: 'Customer',
		filter: { 'openingBalances.currencyId': { $in: ['usd', 'syp'] } },
	},
	{ model: 'Supplier', filter: { aliases: 'x' } },
	{ model: 'Supplier', filter: { aliases: { $in: ['y', 'z'] } } },
	{ model: 'Invoice', filter: { 'items.productId': { $in: ['p1', 'p9'] } } },
	{ model: 'Invoice', filter: { 'tenders.currencyId': 'usd' } },
	{ model: 'Invoice', filter: { status: { $nin: ['draft', 'cancelled'] } } },
]

const MODELS: Record<string, mongoose.Model<any>> = {
	DailyAction,
	Supplier,
	Invoice,
	Products: Product,
	Customer,
} // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!enabled)('mongoQuery matches Mongo semantics', () => {
	let conn: mongoose.Connection

	beforeAll(async () => {
		conn = await mongoose
			.createConnection(process.env.MONGO_TEST_URL!)
			.asPromise()

		for (const [name, docs] of Object.entries(FIXTURES)) {
			const collection = conn.collection(MODELS[name].collection.collectionName)
			const createdBy = { _id: 'u-1', displayName: 'Ana', createdAt: at(1) }
			const stored = docs.map(doc => ({
				_id: new mongoose.Types.ObjectId(),
				tenantId,
				createdBy,
				...doc,
			}))

			await collection.insertMany(stored)

			const result: MapResult = {
				rows: new Map(),
				unmapped: new Map(),
				errors: [],
			}

			// same path real data takes: raw Mongo doc → ETL rows
			mapDocs(
				SPECS.find(s => s.model === MODELS[name].modelName)!,
				stored,
				result,
			)

			for (const [table, rows] of result.rows) {
				if (rows.length)
					await getDb()
						.insert(table)
						.values(rows as never)
			}
		}
	})

	afterAll(async () => {
		await conn?.dropDatabase()
		await conn?.close()
		await closeDb()
	})

	it.each(CASES)('$model $filter', async ({ model, filter, sort, select }) => {
		const Model = MODELS[model]
		let query = conn
			.collection(Model.collection.collectionName)
			.find({ tenantId, ...filter })

		if (sort) query = query.sort(sort as never)

		const fromMongo = (await query.toArray()) as Doc[]
		const fromPg = await pgFind(Model, tenantId, filter, { sort, select })
		const ids = (docs: Doc[]) => docs.map(doc => String(doc._id))

		expect(ids(fromPg)).toEqual(ids(fromMongo))

		if (select) {
			const projection = Object.fromEntries(select.split(' ').map(f => [f, 1]))
			const mongoProjected = (await conn
				.collection(Model.collection.collectionName)
				.find({ tenantId, ...filter }, { projection })
				.toArray()) as Doc[]

			expect(normalize(fromPg)).toEqual(normalize(mongoProjected))
		}
	})

	it('$addToSet appends only when missing, like Mongo', async () => {
		const collection = conn.collection(Supplier.collection.collectionName)

		for (const alias of ['y', 'z']) {
			await collection.updateMany(
				{ tenantId, supplierId: { $in: ['s1', 's3'] } },
				{ $addToSet: { aliases: alias } },
			)

			await pgUpdateMany(
				Supplier,
				tenantId,
				{ supplierId: { $in: ['s1', 's3'] } },
				{ $addToSet: { aliases: alias } },
			)
		}

		const mongo = await collection
			.find({ tenantId })
			.sort({ supplierId: 1 })
			.toArray()
		const pg = await pgFind(Supplier, tenantId, {}, { sort: { supplierId: 1 } })

		expect(pg.map(doc => doc.aliases ?? null)).toEqual(
			mongo.map(doc => doc.aliases ?? null),
		)
	})

	it('refuses what it cannot translate', async () => {
		await expect(
			pgFind(DailyAction, tenantId, { $where: 'x' }),
		).rejects.toThrow('unsupported')

		await expect(
			pgFind(DailyAction, tenantId, { 'foo.bar': 1 }),
		).rejects.toThrow('unsupported field')

		await expect(
			pgFind(DailyAction, tenantId, { note: { $size: 1 } }),
		).rejects.toThrow('unsupported operator')
	})
})
