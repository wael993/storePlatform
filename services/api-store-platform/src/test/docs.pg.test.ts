import { randomUUID } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, getDb, inTransaction } from '../db'
import { deleteDocs, findDoc, findDocs, insertDoc, updateDoc } from '../db/docs'
import { pgFindOne } from '../db/mongoQuery'
import * as t from '../db/schema'
import { Invoice } from '../models/Invoice'
import { Unit } from '../models/Unit'

const enabled = Boolean(process.env.DATABASE_URL)
const actor = { _id: 'u-1', displayName: 'Ana', createdAt: new Date() }

describe.skipIf(!enabled)('document store (Postgres)', () => {
	afterAll(closeDb)

	it('does not freeze when more transactions than pool slots each read outside the tx', async () => {
		// all 12 hold a connection, then each asks for one more (a read without db: tx)
		const done = await Promise.all(
			Array.from({ length: 12 }, () =>
				inTransaction(undefined, async tx => {
					await tx.execute(sql`select pg_sleep(0.2)`)
					await getDb().execute(sql`select 1`)

					return true
				}),
			),
		)

		expect(done).toHaveLength(12)
	}, 15_000)

	it('stores an invoice like Mongoose and reads the same document back', async () => {
		const tenantId = `t-${randomUUID()}`
		const created = await insertDoc(Invoice, {
			tenantId,
			invoiceId: 'inv-1',
			invoiceNumber: '1001',
			warehouseId: 'wh-1',
			issuedAt: new Date('2026-11-01T10:00:00Z'),
			createdBy: actor,
			items: [
				{ productId: 'p-1', name: 'Tea', quantity: 2, unitPrice: 1.5 },
				{ productId: 'p-2', name: 'Cup', quantity: 1, unitPrice: 3 },
			],
			currencyAmounts: [
				{
					currencyId: 'usd',
					name: 'USD',
					exchangeRate: 1,
					isPrimary: true,
					amount: 6,
					paidAmount: 6,
					remainingAmount: 0,
					subtotal: 6,
					tax: 0,
					discount: 0,
				},
			],
		})

		expect(created._id).toMatch(/^[0-9a-f]{24}$/) // same _id format as Mongo

		// a select loads only the child tables it names, but always those
		const only = (select: Record<string, number>) =>
			pgFindOne(Invoice, tenantId, { invoiceId: 'inv-1' }, { select })

		expect((await only({ items: 1 })).items).toHaveLength(2)
		expect(await only({ 'currencyAmounts.currencyId': 1 })).toMatchObject({
			currencyAmounts: [{ currencyId: 'usd' }],
		})

		expect(await only({ invoiceId: 1 })).toEqual({
			_id: created._id,
			invoiceId: 'inv-1',
		})

		const found = await findDoc(
			t.invoices,
			tenantId,
			eq(t.invoices.invoiceId, 'inv-1'),
		)

		expect(found).toMatchObject({
			_id: created._id,
			invoiceId: 'inv-1',
			status: 'draft', // Mongoose default applied
			paymentStatus: 'unpaid',
			invoiceDiscount: 0,
			createdBy: { _id: 'u-1', displayName: 'Ana' },
		})

		expect(
			(found?.items as Array<{ productId: string; discount: number }>).map(
				i => [i.productId, i.discount],
			),
		).toEqual([
			['p-1', 0],
			['p-2', 0],
		])

		expect(found).not.toHaveProperty('tenders') // Mongo default: absent
		expect(await findDocs(t.invoices, `t-${randomUUID()}`)).toEqual([]) // other tenant sees nothing
	})

	it('keeps Mongoose validation and casting', async () => {
		const tenantId = `t-${randomUUID()}`

		await expect(
			insertDoc(Unit, { tenantId, name: 'kg', createdBy: actor }),
		).rejects.toThrow(/unitId/)

		await insertDoc(Unit, {
			tenantId,
			unitId: 'u-1',
			name: ' kg ',
			internalCode: 'kg',
			createdBy: actor,
		})

		expect(
			await findDoc(t.units, tenantId, eq(t.units.unitId, 'u-1')),
		).toMatchObject({
			name: 'kg', // trim
			internalCode: 'KG', // uppercase
		})
	})

	it('updates like $set: replaces child arrays, validates only changed paths, no lost update', async () => {
		const tenantId = `t-${randomUUID()}`
		const byId = eq(t.invoices.invoiceId, 'inv-old')

		// old record without the now-required issuedAt (Mongo allowed editing it)
		await getDb()
			.insert(t.invoices)
			.values({
				id: randomUUID().replace(/-/g, '').slice(0, 24),
				tenantId,
				invoiceId: 'inv-old',
				status: 'draft',
			})

		await getDb()
			.insert(t.invoiceItems)
			.values({
				invoiceRowId: (await findDoc(t.invoices, tenantId, byId))!
					._id as string,
				tenantId,
				position: 0,
				productId: 'p-old',
				name: 'Old',
				quantity: '1',
				unitPrice: '1',
			})

		const updated = await updateDoc(Invoice, tenantId, byId, {
			items: [{ productId: 'p-new', name: 'New', quantity: 3, unitPrice: 2 }],
		})

		expect(
			(updated?.items as Array<{ productId: string }>).map(i => i.productId),
		).toEqual(['p-new'])

		await updateDoc(Invoice, tenantId, byId, { notes: 'n0' })

		// A edits and keeps its transaction open; B edits meanwhile. B must wait
		// for A and keep A's change (no lost update).
		let releaseA = () => {}
		const aHeld = new Promise<void>(resolve => (releaseA = resolve))
		let aLocked = () => {}
		const aUpdated = new Promise<void>(resolve => (aLocked = resolve))
		const a = getDb().transaction(async tx => {
			await updateDoc(Invoice, tenantId, byId, { notes: 'note' }, tx)
			aLocked()
			await aHeld
		})

		await aUpdated
		const b = updateDoc(Invoice, tenantId, byId, { salesPerson: 'Sam' })

		await new Promise(resolve => setTimeout(resolve, 150))
		releaseA()
		await Promise.all([a, b])

		expect(await findDoc(t.invoices, tenantId, byId)).toMatchObject({
			notes: 'note',
			salesPerson: 'Sam',
		})

		expect(
			await updateDoc(Invoice, tenantId, eq(t.invoices.invoiceId, 'nope'), {
				notes: 'x',
			}),
		).toBeNull()

		const deleted = await deleteDocs(t.invoices, tenantId, byId)

		expect(deleted).toHaveLength(1)
		expect(
			await getDb()
				.select()
				.from(t.invoiceItems)
				.where(eq(t.invoiceItems.tenantId, tenantId)),
		).toEqual([])
	})

	it('fails closed without tenant', async () => {
		await expect(findDocs(t.units, undefined)).rejects.toThrow(
			'missing tenant context',
		)
	})
})
