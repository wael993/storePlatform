import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, DbTx, getDb, inTransaction } from '../db'
import { insertDoc } from '../db/docs'
import {
	allocateInvoiceNumber,
	allocateOfflineBlock,
	lastUnitPricesByProduct,
	lockUnchangedInvoice,
	nextInvoiceSequence,
} from '../db/repos/invoices'
import { invoiceItems, invoices } from '../db/schema'
import { Invoice } from '../models/Invoice'

const enabled = Boolean(process.env.DATABASE_URL)
const actor = { _id: 'u-1', displayName: 'Ana', createdAt: new Date() }
const tenant = () => `t-${randomUUID()}`

const sale = (
	tenantId: string,
	invoiceNumber: string,
	extra: Record<string, unknown> = {},
	db?: DbTx,
) =>
	insertDoc(
		Invoice,
		{
			tenantId,
			invoiceId: randomUUID(),
			invoiceNumber,
			warehouseId: 'wh-1',
			issuedAt: new Date('2026-01-01'),
			status: 'paid',
			createdBy: actor,
			currencyAmounts: [
				{
					currencyId: 'usd',
					name: 'USD',
					exchangeRate: 1,
					isPrimary: true,
					amount: 1,
					paidAmount: 1,
					remainingAmount: 0,
					subtotal: 1,
					tax: 0,
					discount: 0,
				},
			],
			...extra,
		},
		db,
	)

describe.skipIf(!enabled)('invoice numbers and last prices (Postgres)', () => {
	afterAll(closeDb)

	it('allocates like the Mongo controller', async () => {
		const tenantId = tenant()

		expect(await allocateInvoiceNumber(tenantId, 'SI', undefined)).toBe(
			'SI-000001',
		)

		await sale(tenantId, 'SI-000001')
		await sale(tenantId, '1007') // legacy bare number still counts

		expect(await allocateInvoiceNumber(tenantId, 'SI', undefined)).toBe(
			'SI-001008',
		)

		// free offline-reserved number is accepted, a taken one is not
		expect(await allocateInvoiceNumber(tenantId, 'SI', 'SI-000500')).toBe(
			'SI-000500',
		)

		expect(await allocateInvoiceNumber(tenantId, 'SI', 'SI-000001')).toBe(
			'SI-001008',
		)

		// bare client drafts are ignored
		expect(await allocateInvoiceNumber(tenantId, 'SI', '42')).toBe('SI-001008')
	})

	it('gives parallel creates different numbers (INV-NUM-1)', async () => {
		const tenantId = tenant()
		const create = () =>
			inTransaction(undefined, async tx => {
				const invoiceNumber = await allocateInvoiceNumber(
					tenantId,
					'SI',
					undefined,
					tx,
				)

				// stands in for the stock and cash writes between number and insert
				await new Promise(resolve => setTimeout(resolve, 50))
				await sale(tenantId, invoiceNumber, {}, tx)

				return invoiceNumber
			})
		const numbers = await Promise.all(Array.from({ length: 8 }, create))

		expect(new Set(numbers).size).toBe(8)
	})

	it('never reserves an offline block over an uncommitted online number', async () => {
		const tenantId = tenant()
		let block: Promise<{ blockStart: number; blockEnd: number }> | undefined

		const online = await inTransaction(undefined, async tx => {
			const invoiceNumber = await allocateInvoiceNumber(
				tenantId,
				'SI',
				undefined,
				tx,
			)

			await sale(tenantId, invoiceNumber, {}, tx)
			// a device asks for its offline block while this sale is not committed yet
			block = allocateOfflineBlock(tenantId, 'selling', 500)
			await new Promise(resolve => setTimeout(resolve, 200))

			return invoiceNumber
		})
		const { blockStart } = await block!

		expect(online).toBe('SI-000001')
		expect(blockStart).toBeGreaterThan(1)
	})

	it('lets only one of two edits from the same snapshot through (EDIT-RACE)', async () => {
		const tenantId = tenant()
		const created = await sale(tenantId, 'SI-000001')
		const invoiceId = created.invoiceId as string
		const edit = () =>
			inTransaction(undefined, async tx => {
				await lockUnchangedInvoice(
					tx,
					'selling',
					tenantId,
					invoiceId,
					created.updatedAt,
				)

				// stands in for reversing and re-applying the stock lines
				await new Promise(resolve => setTimeout(resolve, 50))
				await tx
					.update(invoices)
					.set({ updatedAt: new Date() })
					.where(eq(invoices.invoiceId, invoiceId))
			})
		const results = await Promise.allSettled([edit(), edit()])

		expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
		expect(results.find(r => r.status === 'rejected')?.reason?.message).toMatch(
			/changed meanwhile/,
		)
	})

	it('reserves offline blocks atomically and raises the online floor', async () => {
		const tenantId = tenant()
		const first = await allocateOfflineBlock(tenantId, 'selling', 500)

		expect(first).toEqual({ blockStart: 1, blockEnd: 500 })
		expect(await nextInvoiceSequence(tenantId, 'selling')).toBe(501)

		const blocks = await Promise.all(
			Array.from({ length: 5 }, () =>
				allocateOfflineBlock(tenantId, 'selling', 500),
			),
		)
		const starts = blocks.map(b => b.blockStart).sort((a, b) => a - b)

		expect(starts).toEqual([501, 1001, 1501, 2001, 2501]) // no overlap
		expect(await nextInvoiceSequence(tenantId, 'selling')).toBe(3001)
		// buying blocks are independent
		expect(await allocateOfflineBlock(tenantId, 'buying', 500)).toEqual({
			blockStart: 1,
			blockEnd: 500,
		})

		// buying online numbers ignore the offline floor (as in Mongo)
		expect(await nextInvoiceSequence(tenantId, 'buying')).toBe(1)
	})

	it('takes the newest posted price per product', async () => {
		const tenantId = tenant()
		const line = (productId: string, unitPrice: number) => ({
			productId,
			name: productId,
			quantity: 1,
			unitPrice,
		})

		await sale(tenantId, 'SI-1', { items: [line('p-1', 5)] })
		await sale(tenantId, 'SI-2', {
			issuedAt: new Date('2026-02-01'),
			items: [line('p-1', 6), line('p-1', 6.5), line('p-2', 3)],
		})

		await sale(tenantId, 'SI-3', {
			issuedAt: new Date('2026-03-01'),
			status: 'draft', // excluded
			items: [line('p-1', 9)],
		})

		// no status (counts as posted, like $nin) and no issuedAt (sorts last)
		const id = randomUUID().replace(/-/g, '').slice(0, 24)

		await getDb().insert(invoices).values({ id, tenantId, invoiceNumber: 'X' })
		await getDb()
			.insert(invoiceItems)
			.values(
				[
					['p-3', '7'],
					['p-1', '99'], // newer than nothing: undated must not win
				].map(([productId, unitPrice], position) => ({
					invoiceRowId: id,
					tenantId,
					position,
					productId,
					name: productId,
					quantity: '1',
					unitPrice,
				})),
			)

		const prices = await lastUnitPricesByProduct(tenantId, 'selling')

		expect(Object.fromEntries(prices)).toEqual({ 'p-1': 6, 'p-2': 3, 'p-3': 7 })
	})
})
