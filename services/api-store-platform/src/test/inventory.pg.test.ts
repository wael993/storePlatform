import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, getDb, inTransaction } from '../db'
import { insertDoc } from '../db/docs'
import {
	adjustInventoryQuantity,
	claimWarehouseTransferLegs,
	purchaseInventoryAdjustment,
} from '../db/repos/inventory'
import { pgFind } from '../db/mongoQuery'
import { inventories } from '../db/schema'
import { Inventory } from '../models/Inventory'
import { StockMoving } from '../models/StockMovings'

const enabled = Boolean(process.env.DATABASE_URL)
const actor = { _id: 'u-1', displayName: 'Ana', createdAt: new Date() }

const setup = () => ({
	tenantId: `t-${randomUUID()}`,
	productId: 'p-1',
	warehouseId: 'wh-1',
	actor,
})

const adjust = (
	base: ReturnType<typeof setup>,
	quantityDelta: number,
	extra: { allowNegative?: boolean; seedAverageCost?: number } = {},
) =>
	getDb().transaction(tx =>
		adjustInventoryQuantity(tx, { ...base, quantityDelta, ...extra }),
	)

const purchase = (
	base: ReturnType<typeof setup>,
	purchaseQuantity: number,
	purchaseUnitPrice: number,
) =>
	getDb().transaction(tx =>
		purchaseInventoryAdjustment(tx, {
			...base,
			purchaseQuantity,
			purchaseUnitPrice,
		}),
	)

describe.skipIf(!enabled)('inventory writes (Postgres)', () => {
	afterAll(closeDb)

	it('upserts on first write and gates decreases on quantity - reserved', async () => {
		const base = setup()
		const first = await adjust(base, 5)

		expect(first).toMatchObject({
			productId: 'p-1',
			quantity: 5,
			availableQuantity: 5,
			createdBy: { _id: 'u-1', displayName: 'Ana' },
		})

		expect(first.inventoryId).toBe(first._id)

		await expect(adjust(base, -6)).rejects.toThrow(
			'Insufficient stock for product p-1.',
		)

		await getDb()
			.update(inventories)
			.set({ reservedQuantity: '2' })
			.where(eq(inventories.tenantId, base.tenantId))

		await expect(adjust(base, -4)).rejects.toThrow('Insufficient stock')
		expect(await adjust(base, -3)).toMatchObject({
			quantity: 2,
			availableQuantity: 0, // max(0, 2 - 2)
		})
	})

	it('lets reversals go negative when allowed', async () => {
		const base = setup()

		await adjust(base, 1)
		expect(await adjust(base, -4, { allowNegative: true })).toMatchObject({
			quantity: -3,
			availableQuantity: 0,
		})
	})

	it('keeps the weighted moving average cost of purchases', async () => {
		const base = setup()

		expect(await purchase(base, 10, 2)).toMatchObject({
			quantity: 10,
			averageCost: 2,
		})

		expect(await purchase(base, 10, 4)).toMatchObject({
			quantity: 20,
			averageCost: 3,
		})

		// stock sold below zero: prior quantity counts as 0, so the new price wins
		await adjust(base, -25, { allowNegative: true })
		expect(await purchase(base, 10, 4.5)).toMatchObject({
			quantity: 5,
			averageCost: 4.5,
		})

		// transfer-in seeds the same weighted average
		expect(await adjust(base, 5, { seedAverageCost: 2.5 })).toMatchObject({
			quantity: 10,
			averageCost: 3.5, // (5 * 4.5 + 5 * 2.5) / 10
		})
	})

	it('lets only one of two simultaneous sales take the last items', async () => {
		const base = setup()

		await adjust(base, 5)

		const results = await Promise.allSettled([
			adjust(base, -4),
			adjust(base, -4),
		])

		expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected'])

		const [row] = await getDb()
			.select()
			.from(inventories)
			.where(
				and(
					eq(inventories.tenantId, base.tenantId),
					eq(inventories.productId, 'p-1'),
				),
			)

		expect(Number(row.quantity)).toBe(1)
	})

	it('retries a transaction that lost a deadlock (Mongo withTransaction did too)', async () => {
		const base = setup()
		const p1 = { ...base, productId: 'p-1' }
		const p2 = { ...base, productId: 'p-2' }

		await adjust(p1, 10)
		await adjust(p2, 10)

		// Both transactions lock their first row, meet here, then want the other's row.
		let arrived = 0
		let release = () => {}
		const bothLocked = new Promise<void>(resolve => (release = resolve))
		const meet = async () => {
			arrived += 1

			if (arrived === 2) release()

			await bothLocked
		}
		const crossing = (first: typeof p1, second: typeof p1) =>
			inTransaction(undefined, async tx => {
				await adjustInventoryQuantity(tx, { ...first, quantityDelta: 1 })
				await meet()
				await adjustInventoryQuantity(tx, { ...second, quantityDelta: 1 })
			})

		const results = await Promise.allSettled([
			crossing(p1, p2),
			crossing(p2, p1),
		])

		expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled'])

		const rows = await pgFind(
			Inventory,
			base.tenantId,
			{},
			{ sort: { productId: 1 } },
		)

		expect(rows.map(row => row.quantity)).toEqual([12, 12])
	})

	it('accepts 70,000 ids in one $in (one array parameter, not 70,000)', async () => {
		const ids = Array.from({ length: 70_000 }, (_, i) => `p-${i}`)

		await expect(
			pgFind(Inventory, setup().tenantId, { productId: { $in: ids } }),
		).resolves.toEqual([])
	})

	it('reverses a warehouse transfer only once', async () => {
		const { tenantId } = setup()
		const transfer = {
			referenceId: 'tr-1',
			fromWarehouseId: 'wh-a',
			toWarehouseId: 'wh-b',
			items: [{ productId: 'p-1', quantity: 3 }],
		}
		const leg = (type: string, warehouseId: string) =>
			insertDoc(StockMoving, {
				tenantId,
				stockMovingId: randomUUID(),
				productId: 'p-1',
				warehouseId,
				type,
				quantity: 3,
				referenceType: 'warehouse_transfer',
				referenceId: 'tr-1',
				createdBy: actor,
			})

		await leg('transfer_out', 'wh-a')
		await leg('transfer_in', 'wh-b')

		const claim = () =>
			getDb().transaction(tx =>
				claimWarehouseTransferLegs(tx, tenantId, transfer),
			)
		const results = await Promise.allSettled([claim(), claim()])

		expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected'])
		await expect(claim()).rejects.toThrow(
			'This warehouse transfer changed meanwhile. Reload and try again.',
		)
	})
})
