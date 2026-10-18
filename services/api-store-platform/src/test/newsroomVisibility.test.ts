import { describe, expect, it } from 'vitest'

import { AuthorizationError } from '../middleware/errorHandler'
import {
	assertNewsroomTenantEligible,
	countUnreadNewsroomNotes,
	ensureNewsroomManage,
	ensureNewsroomRead,
	isNewsroomPubliclyVisible,
	NEWSROOM_FEED_STATE_ID,
	NEWSROOM_NOTE_STATUS,
	pinnedIdsForUser,
	selectPublicNewsroomNotes,
} from '../shared/newsroom'
import { RequestContext } from '../shared/types'
import { TENANT_STATUS } from '../shared/constants/tenant.constants'

const now = new Date('2026-10-16T12:00:00.000Z')

const note = (
	id: string,
	status: string,
	releaseDateTime: string,
): { id: string; status: string; releaseDateTime: Date } => ({
	id,
	status,
	releaseDateTime: new Date(releaseDateTime),
})

const catalog = [
	note('due', NEWSROOM_NOTE_STATUS.PUBLISHED, '2026-10-16T11:00:00.000Z'),
	note('future', NEWSROOM_NOTE_STATUS.PUBLISHED, '2026-10-16T13:00:00.000Z'),
	note('draft', NEWSROOM_NOTE_STATUS.DRAFT, '2026-10-01T00:00:00.000Z'),
	note(
		'unpublished',
		NEWSROOM_NOTE_STATUS.UNPUBLISHED,
		'2026-10-01T00:00:00.000Z',
	),
]

describe('NEWS-018 newsroom visibility', () => {
	it('eligible user sees published due content', () => {
		expect(
			selectPublicNewsroomNotes(catalog, now).map(item => item.id),
		).toEqual(['due'])
	})

	it('denies unsigned-in users and non-tenant roles', async () => {
		await expect(
			ensureNewsroomRead({
				role: 'admin',
				tenantId: 't1',
				allowedFields: [],
			} as RequestContext),
		).rejects.toBeInstanceOf(AuthorizationError)

		await expect(
			ensureNewsroomRead({
				userId: 'u1',
				role: 'not-a-role',
				tenantId: 't1',
				allowedFields: [],
			} as RequestContext),
		).rejects.toBeInstanceOf(AuthorizationError)
	})

	it('denies inactive tenants', () => {
		expect(() => assertNewsroomTenantEligible(null)).toThrow(AuthorizationError)
		expect(() =>
			assertNewsroomTenantEligible({ status: TENANT_STATUS.INACTIVE }),
		).toThrow(AuthorizationError)

		expect(() =>
			assertNewsroomTenantEligible({ status: TENANT_STATUS.ACTIVE }),
		).not.toThrow()
	})

	it('denies tenant roles on management APIs', async () => {
		await expect(
			ensureNewsroomManage({
				userId: 'u1',
				role: 'admin',
				tenantId: 't1',
				allowedFields: [],
			} as RequestContext),
		).rejects.toBeInstanceOf(AuthorizationError)
	})

	it('hides draft, unpublished, and future-dated notes from the public rule', () => {
		expect(
			isNewsroomPubliclyVisible(
				NEWSROOM_NOTE_STATUS.DRAFT,
				new Date('2026-10-01T00:00:00.000Z'),
				now,
			),
		).toBe(false)

		expect(
			isNewsroomPubliclyVisible(
				NEWSROOM_NOTE_STATUS.UNPUBLISHED,
				new Date('2026-10-01T00:00:00.000Z'),
				now,
			),
		).toBe(false)

		expect(
			isNewsroomPubliclyVisible(
				NEWSROOM_NOTE_STATUS.PUBLISHED,
				new Date('2026-10-16T13:00:00.000Z'),
				now,
			),
		).toBe(false)
	})

	it('future-dated published notes become visible after release time', () => {
		const releaseDateTime = new Date('2026-10-16T13:00:00.000Z')

		expect(
			isNewsroomPubliclyVisible(
				NEWSROOM_NOTE_STATUS.PUBLISHED,
				releaseDateTime,
				new Date('2026-10-16T12:59:00.000Z'),
			),
		).toBe(false)

		expect(
			isNewsroomPubliclyVisible(
				NEWSROOM_NOTE_STATUS.PUBLISHED,
				releaseDateTime,
				new Date('2026-10-16T13:00:00.000Z'),
			),
		).toBe(true)
	})

	it('pins are user-specific', () => {
		const rows = [
			{ userId: 'a', newsroomItemId: 'due', pinned: true },
			{ userId: 'b', newsroomItemId: 'due', pinned: false },
			{ userId: 'a', newsroomItemId: NEWSROOM_FEED_STATE_ID, pinned: true },
		]

		expect(pinnedIdsForUser(rows, 'a')).toEqual(['due'])
		expect(pinnedIdsForUser(rows, 'b')).toEqual([])
	})

	it('unread clears after visit', () => {
		expect(countUnreadNewsroomNotes(catalog, null, now)).toBe(1)
		expect(
			countUnreadNewsroomNotes(
				catalog,
				new Date('2026-10-16T11:30:00.000Z'),
				now,
			),
		).toBe(0)
	})

	it('direct id fetch uses the same public rule as the list', () => {
		const visibleIds = selectPublicNewsroomNotes(catalog, now).map(
			item => item.id,
		)

		for (const item of catalog) {
			expect(
				isNewsroomPubliclyVisible(item.status, item.releaseDateTime, now),
			).toBe(visibleIds.includes(item.id))
		}
	})
})
