import { v4 as uuidv4 } from 'uuid'

import { ALL_TENANTS, DbTx, inTransaction, isUniqueViolation } from '../../db'
import { insertDoc, insertDocs } from '../../db/docs'
import {
	pgCount,
	pgDeleteMany,
	pgFind,
	pgFindOne,
	pgFindOneAndUpdate,
} from '../../db/mongoQuery'
import { BusinessLogicError } from '../../middleware/errorHandler'
import {
	INewsroomReleaseNote,
	INewsroomTopic,
	NewsroomChange,
	NewsroomReleaseNote,
	NewsroomTopic,
	NewsroomUserState,
} from '../../models/Newsroom'
import { ERROR_CODES } from '../../shared/errorCodes'
import {
	assertReleaseNoteComplete,
	assertReleaseNoteEditable,
	assertTopicUnused,
	DraftNoteInput,
	ensureNewsroomManage,
	ensureNewsroomRead,
	escapeRegex,
	countUnreadNewsroomNotes,
	isNewsroomPubliclyVisible,
	NEWSROOM_FEED_STATE_ID,
	pinnedIdsForUser,
	selectPublicNewsroomNotes,
	NEWSROOM_NOTE_STATUS,
	parseDraftReleaseNote,
	parseFeedFilters,
	parseNoteListFilters,
	parseTopicName,
	publicReleaseNoteFilter,
	topicNameKey,
} from '../../shared/newsroom'
import { RequestContext } from '../../shared/types'

export type NewsroomTopicView = {
	topicId: string
	name: string
	createdAt: string
	updatedAt: string
}

export type NewsroomChangeView = {
	changeId: string
	title: string
	type: string
	description: string
	image: string
	topicId: string
	topicName: string
	sortOrder: number
}

export type NewsroomReleaseNoteListItem = {
	releaseNoteId: string
	title: string
	status: string
	releaseDateTime: string | null
	topics: { topicId: string; name: string }[]
	createdAt: string
	updatedAt: string
}

export type NewsroomReleaseNoteView = NewsroomReleaseNoteListItem & {
	description: string
	version: string
	changes: NewsroomChangeView[]
}

export type NewsroomPublicListItem = {
	releaseNoteId: string
	title: string
	description: string
	releaseDateTime: string | null
	image: string
	topicName: string
	topics: { topicId: string; name: string }[]
	pinned: boolean
}

export type NewsroomPublicDetail = NewsroomPublicListItem & {
	version: string
	changes: NewsroomChangeView[]
}

const duplicateNameError = () =>
	new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
		'A topic with this name already exists.',
	)

const noteNotFound = (action: 'update' | 'read' | 'delete') =>
	new BusinessLogicError(
		action === 'read'
			? ERROR_CODES.DOCUMENTS.DOCUMENT_READ_ERROR
			: action === 'delete'
				? ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR
				: ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
		'Release note not found.',
	)

const mapTopic = (topic: INewsroomTopic): NewsroomTopicView => ({
	topicId: topic.topicId,
	name: topic.name,
	createdAt: topic.createdAt.toISOString(),
	updatedAt: topic.updatedAt.toISOString(),
})

const toIso = (value?: Date | null): string | null =>
	value ? value.toISOString() : null

const uniqueTopics = (
	changes: { topicId: string; topicName: string }[],
): { topicId: string; name: string }[] => {
	const seen = new Set<string>()
	const topics: { topicId: string; name: string }[] = []

	for (const change of changes) {
		if (!change.topicId || seen.has(change.topicId)) continue

		seen.add(change.topicId)
		topics.push({ topicId: change.topicId, name: change.topicName })
	}

	return topics
}

const newsroomActor = (
	requestContext: RequestContext,
	kind: 'create' | 'update',
) => {
	const actor = {
		_id: requestContext.userId ?? '',
		displayName:
			`${requestContext.user?.firstName ?? ''} ${requestContext.user?.lastName ?? ''}`.trim(),
		role: requestContext.user?.role ?? requestContext.role,
	}

	return kind === 'create'
		? { ...actor, createdAt: new Date() }
		: { ...actor, updatedAt: new Date() }
}

export default class NewsroomController {
	public async listTopics(
		requestContext: RequestContext,
	): Promise<{ data: NewsroomTopicView[] }> {
		await ensureNewsroomRead(requestContext)

		const topics = await pgFind<INewsroomTopic>(
			NewsroomTopic,
			ALL_TENANTS,
			{},
			{ sort: { name: 1 } },
		)

		return { data: topics.map(mapTopic) }
	}

	public async createTopic(
		requestBody: { name?: unknown },
		requestContext: RequestContext,
	): Promise<NewsroomTopicView> {
		await ensureNewsroomManage(requestContext)

		const name = parseTopicName(requestBody.name)
		const nameKey = topicNameKey(name)

		try {
			const topic = await insertDoc(NewsroomTopic, {
				topicId: uuidv4(),
				name,
				nameKey,
			})

			return mapTopic(topic as unknown as INewsroomTopic)
		} catch (error: unknown) {
			if (isUniqueViolation(error)) {
				throw duplicateNameError()
			}

			throw error
		}
	}

	public async updateTopic(
		topicId: string,
		requestBody: { name?: unknown },
		requestContext: RequestContext,
	): Promise<NewsroomTopicView> {
		await ensureNewsroomManage(requestContext)

		const name = parseTopicName(requestBody.name)
		const nameKey = topicNameKey(name)
		let topic: INewsroomTopic | null

		try {
			topic = await pgFindOneAndUpdate(
				NewsroomTopic,
				ALL_TENANTS,
				{ topicId },
				{ $set: { name, nameKey } },
				{ new: true },
			)
		} catch (error: unknown) {
			if (isUniqueViolation(error)) {
				throw duplicateNameError()
			}

			throw error
		}

		if (!topic) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Topic not found.',
			)
		}

		return mapTopic(topic)
	}

	public async deleteTopic(
		topicId: string,
		requestContext: RequestContext,
	): Promise<void> {
		await ensureNewsroomManage(requestContext)

		const topic = await pgFindOne(NewsroomTopic, ALL_TENANTS, { topicId })

		if (!topic) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR,
				'Topic not found.',
			)
		}

		assertTopicUnused(await pgCount(NewsroomChange, ALL_TENANTS, { topicId }))

		await pgDeleteMany(NewsroomTopic, ALL_TENANTS, { topicId })
	}

	public async listReleaseNotes(
		query: Record<string, unknown>,
		requestContext: RequestContext,
	): Promise<{ data: NewsroomReleaseNoteListItem[] }> {
		await ensureNewsroomManage(requestContext)

		const filters = parseNoteListFilters(query)
		const noteFilter: Record<string, unknown> = {}

		if (filters.title) {
			noteFilter.title = { $regex: escapeRegex(filters.title), $options: 'i' }
		}

		if (filters.status) {
			noteFilter.status = filters.status
		}

		if (filters.releaseDate) {
			noteFilter.releaseDate = filters.releaseDate
		}

		if (filters.topicId) {
			const matching = await pgFind<{ releaseNoteId: string }>(
				NewsroomChange,
				ALL_TENANTS,
				{ topicId: filters.topicId },
				{ select: 'releaseNoteId' },
			)
			const ids = [...new Set(matching.map(change => change.releaseNoteId))]

			noteFilter.releaseNoteId = { $in: ids }
		}

		const notes = await pgFind<INewsroomReleaseNote>(
			NewsroomReleaseNote,
			ALL_TENANTS,
			noteFilter,
			{ sort: { releaseDateTime: -1, createdAt: -1 } },
		)

		return { data: await this.toListItems(notes) }
	}

	public async getReleaseNote(
		releaseNoteId: string,
		requestContext: RequestContext,
	): Promise<NewsroomReleaseNoteView> {
		await ensureNewsroomManage(requestContext)

		return this.toDetail(await this.requireNote(releaseNoteId, 'read'))
	}

	public async createReleaseNote(
		requestBody: unknown,
		requestContext: RequestContext,
	): Promise<NewsroomReleaseNoteView> {
		await ensureNewsroomManage(requestContext)

		const parsed = parseDraftReleaseNote(requestBody)

		await this.assertTopicsExist(parsed.changes)

		const releaseNoteId = uuidv4()
		const note = await inTransaction(undefined, async tx => {
			const created = await insertDoc(
				NewsroomReleaseNote,
				{
					releaseNoteId,
					title: parsed.title,
					description: parsed.description,
					version: parsed.version,
					contentType: 'release_note',
					status: NEWSROOM_NOTE_STATUS.DRAFT,
					releaseDateTime: parsed.releaseDateTime ?? undefined,
					releaseDate: parsed.releaseDate ?? undefined,
					createdBy: newsroomActor(requestContext, 'create'),
				},
				tx,
			)

			await this.replaceChanges(releaseNoteId, parsed, tx)

			return created as unknown as INewsroomReleaseNote
		})

		return this.toDetail(note)
	}

	public async updateReleaseNote(
		releaseNoteId: string,
		requestBody: unknown,
		requestContext: RequestContext,
	): Promise<NewsroomReleaseNoteView> {
		await ensureNewsroomManage(requestContext)

		const note = await this.requireNote(releaseNoteId, 'update')

		assertReleaseNoteEditable(note.status)

		const parsed = parseDraftReleaseNote(requestBody)

		await this.assertTopicsExist(parsed.changes)

		const updated = await inTransaction(undefined, async tx => {
			const saved = await this.updateNote(
				releaseNoteId,
				{
					title: parsed.title,
					description: parsed.description,
					version: parsed.version,
					releaseDateTime: parsed.releaseDateTime,
					releaseDate: parsed.releaseDate,
					updatedBy: newsroomActor(requestContext, 'update'),
				},
				tx,
			)

			await this.replaceChanges(releaseNoteId, parsed, tx)

			return saved
		})

		return this.toDetail(updated)
	}

	public async publishReleaseNote(
		releaseNoteId: string,
		requestContext: RequestContext,
	): Promise<NewsroomReleaseNoteView> {
		await ensureNewsroomManage(requestContext)

		const note = await this.requireNote(releaseNoteId, 'update')
		const changes = await this.loadChangeViews(releaseNoteId)

		assertReleaseNoteComplete({
			title: note.title,
			description: note.description ?? '',
			version: note.version ?? '',
			releaseDateTime: note.releaseDateTime,
			changes,
		})

		await this.assertTopicsExist(changes)

		if (note.status === NEWSROOM_NOTE_STATUS.PUBLISHED) {
			return this.toDetail(note)
		}

		return this.toDetail(
			await this.updateNote(releaseNoteId, {
				status: NEWSROOM_NOTE_STATUS.PUBLISHED,
				updatedBy: newsroomActor(requestContext, 'update'),
			}),
		)
	}

	public async unpublishReleaseNote(
		releaseNoteId: string,
		requestContext: RequestContext,
	): Promise<NewsroomReleaseNoteView> {
		await ensureNewsroomManage(requestContext)

		const note = await this.requireNote(releaseNoteId, 'update')

		if (note.status !== NEWSROOM_NOTE_STATUS.PUBLISHED) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
				'Only published release notes can be unpublished.',
			)
		}

		return this.toDetail(
			await this.updateNote(releaseNoteId, {
				status: NEWSROOM_NOTE_STATUS.UNPUBLISHED,
				updatedBy: newsroomActor(requestContext, 'update'),
			}),
		)
	}

	public async deleteReleaseNote(
		releaseNoteId: string,
		requestContext: RequestContext,
	): Promise<void> {
		await ensureNewsroomManage(requestContext)

		await this.requireNote(releaseNoteId, 'delete')
		await inTransaction(undefined, async tx => {
			await pgDeleteMany(NewsroomChange, ALL_TENANTS, { releaseNoteId }, tx)
			await pgDeleteMany(
				NewsroomUserState,
				ALL_TENANTS,
				{ newsroomItemId: releaseNoteId },
				tx,
			)

			await pgDeleteMany(
				NewsroomReleaseNote,
				ALL_TENANTS,
				{ releaseNoteId },
				tx,
			)
		})
	}

	public async duplicateReleaseNote(
		releaseNoteId: string,
		requestContext: RequestContext,
	): Promise<NewsroomReleaseNoteView> {
		await ensureNewsroomManage(requestContext)

		const note = await this.requireNote(releaseNoteId, 'read')
		const changes = await this.loadChangeViews(releaseNoteId)
		const copyId = uuidv4()
		const copy = await inTransaction(undefined, async tx => {
			const created = await insertDoc(
				NewsroomReleaseNote,
				{
					releaseNoteId: copyId,
					title: `${note.title} (copy)`,
					description: note.description,
					version: note.version,
					contentType: note.contentType,
					status: NEWSROOM_NOTE_STATUS.DRAFT,
					releaseDateTime: note.releaseDateTime,
					releaseDate: note.releaseDate,
					createdBy: newsroomActor(requestContext, 'create'),
				},
				tx,
			)

			await insertDocs(
				NewsroomChange,
				changes.map((change, sortOrder) => ({
					changeId: uuidv4(),
					releaseNoteId: copyId,
					title: change.title,
					...(change.type ? { type: change.type } : {}),
					description: change.description,
					image: change.image,
					topicId: change.topicId,
					sortOrder,
				})),
				tx,
			)

			return created as unknown as INewsroomReleaseNote
		})

		return this.toDetail(copy)
	}

	public async listPublicFeed(
		query: Record<string, unknown>,
		requestContext: RequestContext,
	): Promise<{ data: NewsroomPublicListItem[] }> {
		await ensureNewsroomRead(requestContext)

		const filters = parseFeedFilters(query)
		const noteFilter: Record<string, unknown> = {
			...publicReleaseNoteFilter(),
		}
		let scopedIds: string[] | undefined

		if (filters.title) {
			const rx = { $regex: escapeRegex(filters.title), $options: 'i' }

			noteFilter.$or = [{ title: rx }, { description: rx }]
		}

		if (filters.topicId) {
			const matching = await pgFind<{ releaseNoteId: string }>(
				NewsroomChange,
				ALL_TENANTS,
				{ topicId: filters.topicId },
				{ select: 'releaseNoteId' },
			)

			scopedIds = [...new Set(matching.map(change => change.releaseNoteId))]
		}

		if (filters.pinned) {
			const pins = await pgFind(
				NewsroomUserState,
				ALL_TENANTS,
				{ userId: requestContext.userId },
				{ select: 'userId newsroomItemId pinned' },
			)
			const pinIds = pinnedIdsForUser(pins, requestContext.userId ?? '')

			scopedIds = scopedIds
				? scopedIds.filter(id => pinIds.includes(id))
				: pinIds
		}

		if (scopedIds) {
			noteFilter.releaseNoteId = { $in: scopedIds }
		}

		const notes = selectPublicNewsroomNotes(
			await pgFind<INewsroomReleaseNote>(
				NewsroomReleaseNote,
				ALL_TENANTS,
				noteFilter,
				{ sort: { releaseDateTime: -1 } },
			),
		)

		return {
			data: await this.toPublicItems(notes, requestContext.userId ?? ''),
		}
	}

	public async getPublicFeedItem(
		releaseNoteId: string,
		requestContext: RequestContext,
	): Promise<NewsroomPublicDetail> {
		await ensureNewsroomRead(requestContext)

		const note = await this.requirePublicNote(releaseNoteId)
		const detail = await this.toDetail(note)
		const pin = await pgFindOne(NewsroomUserState, ALL_TENANTS, {
			userId: requestContext.userId,
			newsroomItemId: releaseNoteId,
		})

		return {
			releaseNoteId: detail.releaseNoteId,
			title: detail.title,
			description: detail.description,
			releaseDateTime: detail.releaseDateTime,
			image: detail.changes.find(change => change.image)?.image ?? '',
			topicName: detail.topics[0]?.name ?? '',
			topics: detail.topics,
			pinned: Boolean(pin?.pinned),
			version: detail.version,
			changes: detail.changes,
		}
	}

	public async pinPublicFeedItem(
		releaseNoteId: string,
		pinned: boolean,
		requestContext: RequestContext,
	): Promise<{ pinned: boolean }> {
		await ensureNewsroomRead(requestContext)
		await this.requirePublicNote(releaseNoteId)
		await this.upsertUserState(
			{ userId: requestContext.userId, newsroomItemId: releaseNoteId },
			{ pinned },
		)

		return { pinned }
	}

	public async visitNewsroom(
		requestContext: RequestContext,
	): Promise<{ lastVisitedAt: string }> {
		await ensureNewsroomRead(requestContext)

		const lastVisitedAt = new Date()

		await this.upsertUserState(
			{ userId: requestContext.userId, newsroomItemId: NEWSROOM_FEED_STATE_ID },
			{ lastVisitedAt, pinned: false },
		)

		return { lastVisitedAt: lastVisitedAt.toISOString() }
	}

	public async unreadNewsroomCount(
		requestContext: RequestContext,
	): Promise<{ count: number }> {
		await ensureNewsroomRead(requestContext)

		const visit = await pgFindOne(NewsroomUserState, ALL_TENANTS, {
			userId: requestContext.userId,
			newsroomItemId: NEWSROOM_FEED_STATE_ID,
		})
		const notes = await pgFind(
			NewsroomReleaseNote,
			ALL_TENANTS,
			publicReleaseNoteFilter(),
			{ select: 'status releaseDateTime' },
		)

		return {
			count: countUnreadNewsroomNotes(notes, visit?.lastVisitedAt),
		}
	}

	private async requirePublicNote(
		releaseNoteId: string,
	): Promise<INewsroomReleaseNote> {
		const note = await pgFindOne<INewsroomReleaseNote>(
			NewsroomReleaseNote,
			ALL_TENANTS,
			{ releaseNoteId },
		)

		if (
			!note ||
			!isNewsroomPubliclyVisible(note.status, note.releaseDateTime)
		) {
			throw noteNotFound('read')
		}

		return note
	}

	private async requireNote(
		releaseNoteId: string,
		action: 'update' | 'read' | 'delete',
	): Promise<INewsroomReleaseNote> {
		const note = await pgFindOne<INewsroomReleaseNote>(
			NewsroomReleaseNote,
			ALL_TENANTS,
			{ releaseNoteId },
		)

		if (!note) {
			throw noteNotFound(action)
		}

		return note
	}

	private async updateNote(
		releaseNoteId: string,
		changes: Record<string, unknown>,
		tx?: DbTx,
	): Promise<INewsroomReleaseNote> {
		const note = await pgFindOneAndUpdate(
			NewsroomReleaseNote,
			ALL_TENANTS,
			{ releaseNoteId },
			{ $set: changes },
			{ new: true, tx },
		)

		if (!note) {
			throw noteNotFound('update')
		}

		return note
	}

	/** Upsert; two parallel first clicks: the loser hits the unique index and retries as an update. */
	private async upsertUserState(
		key: { userId?: string; newsroomItemId: string },
		changes: Record<string, unknown>,
	): Promise<void> {
		const upsert = () =>
			pgFindOneAndUpdate(
				NewsroomUserState,
				ALL_TENANTS,
				key,
				{ $set: changes },
				{ upsert: true },
			)

		try {
			await upsert()
		} catch (error: unknown) {
			if (!isUniqueViolation(error)) throw error

			await upsert()
		}
	}

	private async assertTopicsExist(
		changes: { topicId: string }[],
	): Promise<void> {
		const ids = [
			...new Set(changes.map(change => change.topicId).filter(Boolean)),
		]

		if (ids.length === 0) return

		const found = await pgFind<{ topicId: string }>(
			NewsroomTopic,
			ALL_TENANTS,
			{ topicId: { $in: ids } },
			{ select: 'topicId' },
		)
		const foundIds = new Set(found.map(topic => topic.topicId))
		const fields: Record<string, string> = {}

		changes.forEach((change, index) => {
			if (change.topicId && !foundIds.has(change.topicId)) {
				fields[`changes.${index}.topicId`] = 'Topic not found.'
			}
		})

		if (Object.keys(fields).length > 0) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
				'Topic not found.',
				undefined,
				fields,
			)
		}
	}

	private async replaceChanges(
		releaseNoteId: string,
		parsed: DraftNoteInput,
		tx: DbTx,
	): Promise<void> {
		const incoming = parsed.changes.map((change, sortOrder) => ({
			changeId: uuidv4(),
			releaseNoteId,
			title: change.title,
			...(change.type ? { type: change.type } : {}),
			description: change.description,
			image: change.image,
			topicId: change.topicId,
			sortOrder,
		}))

		await pgDeleteMany(NewsroomChange, ALL_TENANTS, { releaseNoteId }, tx)
		await insertDocs(NewsroomChange, incoming, tx)
	}

	private async loadChangeViews(
		releaseNoteId: string,
	): Promise<NewsroomChangeView[]> {
		const changes = await pgFind(
			NewsroomChange,
			ALL_TENANTS,
			{ releaseNoteId },
			{ sort: { sortOrder: 1 } },
		)
		const topicIds = [
			...new Set(changes.map(change => change.topicId).filter(Boolean)),
		]
		const topics = topicIds.length
			? await pgFind(NewsroomTopic, ALL_TENANTS, { topicId: { $in: topicIds } })
			: []
		const names = new Map(topics.map(topic => [topic.topicId, topic.name]))

		return changes.map(change => this.mapChange(change, names))
	}

	private mapChange(
		change: {
			changeId: string
			title: string
			type?: string
			description: string
			image: string
			topicId: string
			sortOrder: number
		},
		names: Map<string, string>,
	): NewsroomChangeView {
		return {
			changeId: change.changeId,
			title: change.title,
			type: change.type ?? '',
			description: change.description,
			image: change.image,
			topicId: change.topicId,
			topicName: names.get(change.topicId) ?? '',
			sortOrder: change.sortOrder,
		}
	}

	private async toListItems(
		notes: INewsroomReleaseNote[],
	): Promise<NewsroomReleaseNoteListItem[]> {
		if (notes.length === 0) return []

		const ids = notes.map(note => note.releaseNoteId)
		const changes = await pgFind(
			NewsroomChange,
			ALL_TENANTS,
			{ releaseNoteId: { $in: ids } },
			{ sort: { sortOrder: 1 } },
		)
		const topicIds = [
			...new Set(changes.map(change => change.topicId).filter(Boolean)),
		]
		const topics = topicIds.length
			? await pgFind(NewsroomTopic, ALL_TENANTS, { topicId: { $in: topicIds } })
			: []
		const names = new Map(topics.map(topic => [topic.topicId, topic.name]))
		const byNote = new Map<string, NewsroomChangeView[]>()

		for (const change of changes) {
			const list = byNote.get(change.releaseNoteId) ?? []

			list.push(this.mapChange(change, names))
			byNote.set(change.releaseNoteId, list)
		}

		return notes.map(note => {
			const noteChanges = byNote.get(note.releaseNoteId) ?? []

			return {
				releaseNoteId: note.releaseNoteId,
				title: note.title,
				status: note.status,
				releaseDateTime: toIso(note.releaseDateTime),
				topics: uniqueTopics(noteChanges),
				createdAt: note.createdAt.toISOString(),
				updatedAt: note.updatedAt.toISOString(),
			}
		})
	}

	private async toDetail(
		note: INewsroomReleaseNote,
	): Promise<NewsroomReleaseNoteView> {
		const changes = await this.loadChangeViews(note.releaseNoteId)

		return {
			releaseNoteId: note.releaseNoteId,
			title: note.title,
			status: note.status,
			releaseDateTime: toIso(note.releaseDateTime),
			topics: uniqueTopics(changes),
			createdAt: note.createdAt.toISOString(),
			updatedAt: note.updatedAt.toISOString(),
			description: note.description,
			version: note.version,
			changes,
		}
	}

	private async toPublicItems(
		notes: INewsroomReleaseNote[],
		userId: string,
	): Promise<NewsroomPublicListItem[]> {
		if (notes.length === 0) return []

		const list = await this.toListItems(notes)
		const byId = new Map(notes.map(note => [note.releaseNoteId, note]))
		const ids = notes.map(note => note.releaseNoteId)
		const changes = await pgFind(
			NewsroomChange,
			ALL_TENANTS,
			{ releaseNoteId: { $in: ids } },
			{ sort: { sortOrder: 1 } },
		)
		const firstImage = new Map<string, string>()

		for (const change of changes) {
			if (change.image && !firstImage.has(change.releaseNoteId)) {
				firstImage.set(change.releaseNoteId, change.image)
			}
		}

		const pins = userId
			? await pgFind(
					NewsroomUserState,
					ALL_TENANTS,
					{ userId, pinned: true, newsroomItemId: { $in: ids } },
					{ select: 'newsroomItemId' },
				)
			: []
		const pinSet = new Set(pins.map(pin => pin.newsroomItemId))

		return list.map(item => {
			const note = byId.get(item.releaseNoteId)

			return {
				releaseNoteId: item.releaseNoteId,
				title: item.title,
				description: note?.description ?? '',
				releaseDateTime: item.releaseDateTime,
				image: firstImage.get(item.releaseNoteId) ?? '',
				topicName: item.topics[0]?.name ?? '',
				topics: item.topics,
				pinned: pinSet.has(item.releaseNoteId),
			}
		})
	}
}
