import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb } from '../db'
import { findDoc, findDocs, insertDoc } from '../db/docs'
import * as t from '../db/schema'
import { Invoice } from '../models/Invoice'
import { Unit } from '../models/Unit'

const enabled = Boolean(process.env.DATABASE_URL)
const actor = { _id: 'u-1', displayName: 'Ana', createdAt: new Date() }

describe.skipIf(!enabled)('document store (Postgres)', () => {
	afterAll(closeDb)

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

	it('fails closed without tenant', async () => {
		await expect(findDocs(t.units, undefined)).rejects.toThrow(
			'missing tenant context',
		)
	})
})
