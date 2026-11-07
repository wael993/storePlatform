import { randomUUID } from 'crypto'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb } from '../db'
import { pgFindOne } from '../db/mongoQuery'
import { Invoice } from '../models/Invoice'
import { COLLECTION_NAMES } from '../shared/general'
import {
	createDocument,
	deleteDocument,
	updateDocument,
} from '../shared/mongodb/documentActions'
import { SEE } from '../shared/seeCatalog'
import type { RequestContext } from '../shared/types'

/** The generic layer routes Postgres-owned models (here: Invoice) to Postgres. */
const enabled = Boolean(process.env.DATABASE_URL)

const contextFor = (tenantId: string) =>
	({
		tenantId,
		role: 'owner',
		userId: 'u-1',
		user: { firstName: 'Ana', lastName: 'B' },
		see: [SEE.sellingInvoices],
	}) as unknown as RequestContext

const invoice = (invoiceId: string) => ({
	invoiceId,
	invoiceNumber: 'SI-000001',
	warehouseId: 'wh-1',
	issuedAt: new Date('2026-11-01'),
	tenantId: 'someone-else', // must be ignored: the context decides the tenant
	currencyAmounts: [
		{
			currencyId: 'usd',
			name: 'USD',
			exchangeRate: 1,
			isPrimary: true,
			amount: 5,
			paidAmount: 5,
			remainingAmount: 0,
			subtotal: 5,
			tax: 0,
			discount: 0,
		},
	],
})

describe.skipIf(!enabled)('documentActions on Postgres', () => {
	afterAll(closeDb)

	it('creates with tenant + createdBy from the context, updates, refuses other tenants', async () => {
		const tenantId = `t-${randomUUID()}`
		const ctx = contextFor(tenantId)
		const { _id } = await createDocument(
			ctx,
			COLLECTION_NAMES.INVOICES,
			Invoice,
			invoice('inv-1'),
		)
		const stored = await pgFindOne(Invoice, tenantId, { _id })

		expect(stored).toMatchObject({
			tenantId,
			invoiceId: 'inv-1',
			createdBy: { _id: 'u-1', displayName: 'Ana B', role: 'owner' },
		})

		const updated = await updateDocument(
			ctx,
			COLLECTION_NAMES.INVOICES,
			Invoice,
			'inv-1',
			{ notes: 'paid in cash' },
		)

		expect(updated).toMatchObject({
			notes: 'paid in cash',
			updatedBy: { _id: 'u-1', displayName: 'Ana B' },
		})

		const otherTenant = contextFor(`t-${randomUUID()}`)

		await expect(
			updateDocument(otherTenant, COLLECTION_NAMES.INVOICES, Invoice, 'inv-1', {
				notes: 'x',
			}),
		).rejects.toThrow('invoices not found.')
	})

	it('lets only one of two parallel deletes succeed', async () => {
		const ctx = contextFor(`t-${randomUUID()}`)

		await createDocument(
			ctx,
			COLLECTION_NAMES.INVOICES,
			Invoice,
			invoice('inv-2'),
		)

		const results = await Promise.allSettled([
			deleteDocument(ctx, COLLECTION_NAMES.INVOICES, Invoice, 'inv-2'),
			deleteDocument(ctx, COLLECTION_NAMES.INVOICES, Invoice, 'inv-2'),
		])

		expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected'])
	})
})
