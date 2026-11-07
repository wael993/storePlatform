import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, getDb } from '../db'
import { pgFindOne } from '../db/mongoQuery'
import { recordSyncMutation } from '../db/repos/sync'
import { syncMutations } from '../db/schema'
import { SyncMutation } from '../models/SyncMutation'

const enabled = Boolean(process.env.DATABASE_URL)

/** What the controller's getProcessedSyncMutation does. */
const processed = (tenantId: string, clientMutationId: string) =>
	pgFindOne(SyncMutation, tenantId, { clientMutationId })

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

		expect(await processed(tenantId, 'm-1')).toBeNull()

		await Promise.all([record({ n: 1 }), record({ n: 1 })]) // duplicate retry
		await record({ invoiceId: 'inv-1' })

		const rows = await getDb()
			.select()
			.from(syncMutations)
			.where(eq(syncMutations.tenantId, tenantId))

		expect(rows).toHaveLength(1)
		expect(await processed(tenantId, 'm-1')).toMatchObject({
			entity: 'invoice',
			result: { invoiceId: 'inv-1' },
		})

		// other tenants never see it
		expect(await processed(`t-${randomUUID()}`, 'm-1')).toBeNull()
	})
})
