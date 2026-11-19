import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../store/store', () => ({
	default: { getState: () => ({ user: { accessToken: 'token' } }) },
}))

import { getSyncMeta, offlineDb, setSyncMeta, SYNC_META_KEYS } from '../offline/db'
import { getOfflineState, pullSyncChanges } from '../offline/syncService'

afterEach(() => vi.unstubAllGlobals())

describe('pull after a backup restore', () => {
	it('flags the device as stale instead of silently skipping, while a failed change waits', async () => {
		await setSyncMeta(SYNC_META_KEYS.tenantId, 't1')
		await setSyncMeta(SYNC_META_KEYS.lastSyncedAt, '2026-11-19T10:00:00.000Z')
		await offlineDb.outbox.add({
			id: 'o1',
			entity: 'product',
			operation: 'update',
			url: 'products/p1',
			method: 'PATCH',
			payload: {},
			clientMutationId: 'm1',
			createdAt: '2026-11-19T09:00:00.000Z',
			retryCount: 3,
			status: 'failed',
		} as never)

		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ resetRequired: true }), { status: 200 }),
		)

		vi.stubGlobal('fetch', fetchMock)
		await pullSyncChanges()

		expect(getOfflineState().restoreResetPending).toBe(true)
		// no bootstrap (it would drop the waiting change), and the next pull asks again
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(await getSyncMeta(SYNC_META_KEYS.lastSyncedAt)).toBe(
			'2026-11-19T10:00:00.000Z',
		)
	})
})
