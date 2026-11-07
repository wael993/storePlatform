import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, getDb } from '../db'
import { insertDoc } from '../db/docs'
import {
	documentsSince,
	getProcessedSyncMutation,
	recordSyncMutation,
} from '../db/repos/sync'
import { dailyActions, syncMutations } from '../db/schema'
import { DailyAction } from '../models/DailyAction'

const enabled = Boolean(process.env.DATABASE_URL)

describe.skipIf(!enabled)('offline sync helpers (Postgres)', () => {
	afterAll(closeDb)

	it('records one mutation per client id and answers replays from it', async () => {
		const tenantId = `t-${randomUUID()}`
		const record = (result: Record<string, unknown>) =>
			recordSyncMutation(tenantId, {
				clientMutationId: 'm-1',
				entity: 'invoice',
				operation: 'create',
				result,
			})

		expect(await getProcessedSyncMutation(tenantId, 'm-1')).toBeNull()

		await Promise.all([record({ n: 1 }), record({ n: 1 })]) // duplicate retry
		await record({ invoiceId: 'inv-1' })

		const rows = await getDb()
			.select()
			.from(syncMutations)
			.where(eq(syncMutations.tenantId, tenantId))

		expect(rows).toHaveLength(1)
		expect(await getProcessedSyncMutation(tenantId, 'm-1')).toMatchObject({
			entity: 'invoice',
			result: { invoiceId: 'inv-1' },
		})

		// other tenants never see it
		expect(
			await getProcessedSyncMutation(`t-${randomUUID()}`, 'm-1'),
		).toBeNull()
	})

	it('returns documents changed since a point in time', async () => {
		const tenantId = `t-${randomUUID()}`
		const action = (actionId: string) =>
			insertDoc(DailyAction, {
				tenantId,
				actionId,
				entryType: 'RECEIPT_ENTRY',
				warehouseId: 'wh-1',
				currencyId: 'usd',
				currencyName: 'USD',
				invoiceDate: new Date(),
				createdBy: { _id: 'u-1', displayName: 'Ana', createdAt: new Date() },
			})

		await action('old')
		await getDb()
			.update(dailyActions)
			.set({ updatedAt: new Date('2026-01-01') })
			.where(eq(dailyActions.actionId, 'old'))

		await action('new')

		const changed = await documentsSince(
			dailyActions,
			tenantId,
			new Date('2026-06-01'),
		)

		expect(changed.map(doc => doc.actionId)).toEqual(['new'])
	})
})
