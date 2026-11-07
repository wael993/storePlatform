import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, getDb } from '../db'
import { insertDoc } from '../db/docs'
import {
	adjustInventoryQuantity,
	claimWarehouseTransferLegs,
	purchaseInventoryAdjustment,
} from '../db/repos/inventory'
import { inventories } from '../db/schema'
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
