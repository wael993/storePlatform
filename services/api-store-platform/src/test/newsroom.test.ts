import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from '../app'
import {
	AuthorizationError,
	BusinessLogicError,
} from '../middleware/errorHandler'
import {
	assertReleaseNoteComplete,
	assertReleaseNoteEditable,
	assertTopicUnused,
	ensureNewsroomManage,
	ensureNewsroomRead,
	isNewsroomPubliclyVisible,
	isNewsroomUnread,
	NEWSROOM_MAX_IMAGE_BYTES,
	NEWSROOM_NOTE_STATUS,
	parseDraftReleaseNote,
	parseFeedFilters,
	parseNoteListFilters,
	parseTopicName,
	topicNameKey,
} from '../shared/newsroom'
import { RequestContext } from '../shared/types'

describe('newsroom topics', () => {
	it('normalizes and rejects empty topic names', () => {
		expect(topicNameKey('  Feature  ')).toBe('feature')
		expect(parseTopicName('  Dashboard  ')).toBe('Dashboard')
		expect(() => parseTopicName('   ')).toThrow(BusinessLogicError)
		expect(() => parseTopicName(undefined)).toThrow(BusinessLogicError)
	})

	it('blocks delete when a change still uses the topic', () => {
		expect(() => assertTopicUnused(0)).not.toThrow()
		expect(() => assertTopicUnused(1)).toThrow(BusinessLogicError)
	})

	it('denies tenant roles on manage APIs before hitting Mongo', async () => {
		await expect(
			ensureNewsroomManage({
				role: 'admin',
				tenantId: 't1',
				allowedFields: [],
			} as RequestContext),
		).rejects.toBeInstanceOf(AuthorizationError)
	})

	it('requires a title on draft notes and rejects bad change types', () => {
		expect(() => parseDraftReleaseNote({})).toThrow(BusinessLogicError)
		expect(parseDraftReleaseNote({ title: '  Warehouse  ' })).toEqual({
			title: 'Warehouse',
			description: '',
			version: '',
			releaseDateTime: null,
			releaseDate: null,
			changes: [],
		})

		expect(
			parseDraftReleaseNote({
				title: 'X',
				status: 'published',
				releaseDate: '2026-10-16',
			}),
		).toEqual({
			title: 'X',
			description: '',
			version: '',
			releaseDateTime: null,
			releaseDate: '2026-10-16',
			changes: [],
		})

		expect(parseNoteListFilters({ releaseDate: '2026-10-16' })).toEqual({
			releaseDate: '2026-10-16',
		})

		expect(() =>
			parseDraftReleaseNote({
				title: 'X',
				changes: [{ type: 'not-a-type' }],
			}),
		).toThrow(BusinessLogicError)

		expect(
			parseDraftReleaseNote({
				title: 'X',
				changes: [{ image: 'https://cdn.example/a.png' }],
			}).changes[0].image,
		).toBe('https://cdn.example/a.png')

		expect(
			parseDraftReleaseNote({
				title: 'X',
				changes: [{ image: 'data:image/png;base64,QQ==' }],
			}).changes[0].image,
		).toBe('data:image/png;base64,QQ==')

		expect(() =>
			parseDraftReleaseNote({
				title: 'X',
				changes: [{ image: 'javascript:alert(1)' }],
			}),
		).toThrow(BusinessLogicError)

		expect(() =>
			parseDraftReleaseNote({
				title: 'X',
				changes: [
					{
						image:
							'data:image/png;base64,' +
							Buffer.alloc(NEWSROOM_MAX_IMAGE_BYTES + 1).toString('base64'),
					},
				],
			}),
		).toThrow(BusinessLogicError)

		expect(() => parseNoteListFilters({ status: 'nope' })).toThrow(
			BusinessLogicError,
		)
	})

	it('rejects unauthenticated topic routes', async () => {
		const app = createApp()
		const list = await request(app).get('/api/data/newsroom/topics')
		const create = await request(app)
			.post('/api/data/newsroom/topics')
			.send({ name: 'x' })
		const update = await request(app)
			.patch('/api/data/newsroom/topics/t1')
			.send({ name: 'x' })
		const remove = await request(app).delete('/api/data/newsroom/topics/t1')

		expect(list.status).toBe(401)
		expect(create.status).toBe(401)
		expect(update.status).toBe(401)
		expect(remove.status).toBe(401)
	})

	it('rejects unauthenticated release-note routes', async () => {
		const app = createApp()
		const list = await request(app).get('/api/data/newsroom/release-notes')
		const create = await request(app)
			.post('/api/data/newsroom/release-notes')
			.send({ title: 'x' })
		const detail = await request(app).get('/api/data/newsroom/release-notes/n1')
		const update = await request(app)
			.patch('/api/data/newsroom/release-notes/n1')
			.send({ title: 'x' })
		const publish = await request(app).post(
			'/api/data/newsroom/release-notes/n1/publish',
		)
		const unpublish = await request(app).post(
			'/api/data/newsroom/release-notes/n1/unpublish',
		)
		const duplicate = await request(app).post(
			'/api/data/newsroom/release-notes/n1/duplicate',
		)
		const remove = await request(app).delete(
			'/api/data/newsroom/release-notes/n1',
		)

		expect(list.status).toBe(401)
		expect(create.status).toBe(401)
		expect(detail.status).toBe(401)
		expect(update.status).toBe(401)
		expect(publish.status).toBe(401)
		expect(unpublish.status).toBe(401)
		expect(duplicate.status).toBe(401)
		expect(remove.status).toBe(401)

		const feed = await request(app).get('/api/data/newsroom/feed')
		const feedItem = await request(app).get('/api/data/newsroom/feed/n1')
		const pin = await request(app).post('/api/data/newsroom/feed/n1/pin')
		const unpin = await request(app).post('/api/data/newsroom/feed/n1/unpin')
		const unread = await request(app).get('/api/data/newsroom/unread-count')
		const visit = await request(app).post('/api/data/newsroom/visit')

		expect(feed.status).toBe(401)
		expect(feedItem.status).toBe(401)
		expect(pin.status).toBe(401)
		expect(unpin.status).toBe(401)
		expect(unread.status).toBe(401)
		expect(visit.status).toBe(401)
	})

	it('blocks incomplete notes from publish and hides future-dated published notes', () => {
		const complete = {
			title: 'Warehouse',
			description: 'Stock counts',
			version: '1.0',
			releaseDateTime: new Date('2026-01-01T00:00:00.000Z'),
			changes: [
				{
					title: 'Counts',
					type: 'feature',
					description: 'See counts per warehouse.',
					image: 'https://example.com/counts.png',
					topicId: 'topic-1',
				},
			],
		}

		expect(() => assertReleaseNoteComplete(complete)).not.toThrow()
		expect(() =>
			assertReleaseNoteComplete({ ...complete, description: '' }),
		).toThrow(BusinessLogicError)

		expect(() =>
			assertReleaseNoteComplete({ ...complete, version: '' }),
		).toThrow(BusinessLogicError)

		expect(() =>
			assertReleaseNoteComplete({ ...complete, releaseDateTime: null }),
		).toThrow(BusinessLogicError)

		expect(() =>
			assertReleaseNoteComplete({ ...complete, changes: [] }),
		).toThrow(BusinessLogicError)

		expect(() =>
			assertReleaseNoteComplete({
				...complete,
				changes: [{ ...complete.changes[0], image: '' }],
			}),
		).toThrow(BusinessLogicError)

		expect(() =>
			assertReleaseNoteComplete({
				...complete,
				changes: [{ ...complete.changes[0], topicId: '' }],
			}),
		).toThrow(BusinessLogicError)

		expect(() => assertReleaseNoteEditable('draft')).not.toThrow()
		expect(() => assertReleaseNoteEditable('unpublished')).not.toThrow()
		expect(() => assertReleaseNoteEditable('published')).toThrow(
			BusinessLogicError,
		)

		const now = new Date('2026-10-16T12:00:00.000Z')

		expect(
			isNewsroomPubliclyVisible(
				NEWSROOM_NOTE_STATUS.PUBLISHED,
				new Date('2026-10-16T11:00:00.000Z'),
				now,
			),
		).toBe(true)

		expect(
			isNewsroomPubliclyVisible(
				NEWSROOM_NOTE_STATUS.PUBLISHED,
				new Date('2026-10-16T13:00:00.000Z'),
				now,
			),
		).toBe(false)

		expect(
			isNewsroomPubliclyVisible(
				NEWSROOM_NOTE_STATUS.DRAFT,
				new Date('2026-01-01T00:00:00.000Z'),
				now,
			),
		).toBe(false)

		expect(
			isNewsroomPubliclyVisible(
				NEWSROOM_NOTE_STATUS.UNPUBLISHED,
				new Date('2026-01-01T00:00:00.000Z'),
				now,
			),
		).toBe(false)
	})

	it('hides unpublished items from the public feed helpers and counts unread after last visit', async () => {
		await expect(
			ensureNewsroomRead({
				role: 'admin',
				tenantId: 't1',
				allowedFields: [],
			} as RequestContext),
		).rejects.toBeInstanceOf(AuthorizationError)

		expect(parseFeedFilters({ title: '  stock  ', pinned: 'true' })).toEqual({
			title: 'stock',
			pinned: true,
		})

		expect(() => parseFeedFilters({ pinned: 'maybe' })).toThrow(
			BusinessLogicError,
		)

		const publishedAt = new Date('2026-10-16T12:00:00.000Z')

		expect(isNewsroomUnread(publishedAt, null)).toBe(true)

		expect(
			isNewsroomUnread(publishedAt, new Date('2026-10-16T11:00:00.000Z')),
		).toBe(true)

		expect(
			isNewsroomUnread(publishedAt, new Date('2026-10-16T13:00:00.000Z')),
		).toBe(false)
	})
})
