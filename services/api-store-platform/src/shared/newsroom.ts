import {
	AuthorizationError,
	BusinessLogicError,
} from '../middleware/errorHandler'
import Tenant from '../models/Tenant'
import { TENANT_STATUS } from './constants/tenant.constants'
import { ERROR_CODES } from './errorCodes'
import {
	ensureSuperAdmin,
	getTenantContext,
	isPlatformSuperAdmin,
} from './tenant'
import { RequestContext } from './types'

export const NEWSROOM_NOTE_STATUS = {
	DRAFT: 'draft',
	PUBLISHED: 'published',
	UNPUBLISHED: 'unpublished',
} as const

export const NEWSROOM_CHANGE_TYPE = {
	FEATURE: 'feature',
	CHANGE: 'change',
	BUG_FIX: 'bug_fix',
} as const

export type NewsroomNoteStatus =
	(typeof NEWSROOM_NOTE_STATUS)[keyof typeof NEWSROOM_NOTE_STATUS]
export type NewsroomChangeType =
	(typeof NEWSROOM_CHANGE_TYPE)[keyof typeof NEWSROOM_CHANGE_TYPE]

export const ensureNewsroomManage = ensureSuperAdmin

/** Sentinel UserState row: feed-level lastVisitedAt (not a release-note pin). */
export const NEWSROOM_FEED_STATE_ID = '__feed__'

export const ensureNewsroomRead = async (
	requestContext: RequestContext,
): Promise<void> => {
	if (!requestContext.userId) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Newsroom requires a signed-in user.',
		)
	}

	if (isPlatformSuperAdmin(requestContext.role, requestContext.tenantId)) {
		await ensureSuperAdmin(requestContext)

		return
	}

	const tenantContext = getTenantContext(requestContext)
	const tenant = await Tenant.findOne({
		tenantId: tenantContext.tenantId,
		status: TENANT_STATUS.ACTIVE,
	}).lean()

	assertNewsroomTenantEligible(tenant)
}

export const assertNewsroomTenantEligible = (
	tenant: { status?: string } | null | undefined,
): void => {
	if (!tenant || tenant.status !== TENANT_STATUS.ACTIVE) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Newsroom is available to active tenants only.',
		)
	}
}

export const topicNameKey = (name: string): string => name.trim().toLowerCase()

export const parseTopicName = (value: unknown): string => {
	if (typeof value !== 'string' || !value.trim()) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			'Topic name is required.',
		)
	}

	return value.trim()
}

/** NEWS-004: reject in-use deletes. Do not reassign topicIds. */
export const assertTopicUnused = (changeCount: number): void => {
	if (changeCount > 0) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_DELETE_ERROR,
			'Topic is in use by a release note change and cannot be deleted.',
		)
	}
}

export const isMongoDuplicateKey = (error: unknown): boolean =>
	typeof error === 'object' &&
	error !== null &&
	'code' in error &&
	(error as { code: unknown }).code === 11000

const CHANGE_TYPES = new Set<string>(Object.values(NEWSROOM_CHANGE_TYPE))
const NOTE_STATUSES = new Set<string>(Object.values(NEWSROOM_NOTE_STATUS))
const DATA_IMAGE = /^data:image\/[a-z0-9.+-]+;base64,/i
const HTTP_IMAGE = /^https?:\/\//i
const MAX_IMAGE_URL_LENGTH = 2048

export const NEWSROOM_MAX_IMAGE_BYTES = 1_200_000

const optionalString = (value: unknown): string =>
	typeof value === 'string' ? value.trim() : ''

const fieldError = (fields: Record<string, string>): BusinessLogicError =>
	new BusinessLogicError(
		ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
		Object.values(fields)[0] ?? 'Validation failed.',
		undefined,
		fields,
	)

export type DraftChangeInput = {
	changeId?: string
	title: string
	type: NewsroomChangeType | ''
	description: string
	image: string
	topicId: string
}

export type DraftNoteInput = {
	title: string
	description: string
	version: string
	releaseDateTime: Date | null
	releaseDate: string | null
	changes: DraftChangeInput[]
}

export const parseDraftReleaseNote = (body: unknown): DraftNoteInput => {
	const payload =
		body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
	const fields: Record<string, string> = {}
	const title = optionalString(payload.title)

	if (!title) {
		fields.title = 'Title is required.'
	}

	let releaseDateTime: Date | null = null
	let releaseDate: string | null = null
	const rawDate = payload.releaseDateTime
	const releaseDateKey = optionalString(payload.releaseDate)

	if (rawDate != null && rawDate !== '') {
		const parsed = new Date(String(rawDate))

		if (Number.isNaN(parsed.getTime())) {
			fields.releaseDateTime = 'Release date/time is invalid.'
		} else {
			releaseDateTime = parsed
		}
	}

	if (releaseDateKey) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDateKey)) {
			fields.releaseDate = 'Release date must be YYYY-MM-DD.'
		} else {
			releaseDate = releaseDateKey
		}
	}

	const rawChanges = Array.isArray(payload.changes) ? payload.changes : []
	const changes: DraftChangeInput[] = rawChanges.map((raw, index) => {
		const change =
			raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
		const type = optionalString(change.type)

		if (type && !CHANGE_TYPES.has(type)) {
			fields[`changes.${index}.type`] = 'Change type is invalid.'
		}

		const changeId = optionalString(change.changeId)
		const image = typeof change.image === 'string' ? change.image.trim() : ''
		const imageField = `changes.${index}.image`

		if (image) {
			if (DATA_IMAGE.test(image)) {
				const bytes = Buffer.from(
					image.slice(image.indexOf(',') + 1),
					'base64',
				).length

				if (bytes > NEWSROOM_MAX_IMAGE_BYTES) {
					fields[imageField] = 'Image is too large.'
				}
			} else if (
				!HTTP_IMAGE.test(image) ||
				image.length > MAX_IMAGE_URL_LENGTH
			) {
				fields[imageField] =
					'Image must be an http(s) URL or an image data URL.'
			}
		}

		return {
			changeId: changeId || undefined,
			title: optionalString(change.title),
			type: CHANGE_TYPES.has(type) ? (type as NewsroomChangeType) : '',
			description: optionalString(change.description),
			image,
			topicId: optionalString(change.topicId),
		}
	})

	if (Object.keys(fields).length > 0) {
		throw fieldError(fields)
	}

	return {
		title,
		description: optionalString(payload.description),
		version: optionalString(payload.version),
		releaseDateTime,
		releaseDate,
		changes,
	}
}

export const parseNoteListFilters = (query: {
	title?: unknown
	status?: unknown
	releaseDate?: unknown
	topicId?: unknown
}): {
	title?: string
	status?: NewsroomNoteStatus
	releaseDate?: string
	topicId?: string
} => {
	const title = optionalString(query.title)
	const status = optionalString(query.status)
	const releaseDate = optionalString(query.releaseDate)
	const topicId = optionalString(query.topicId)
	const fields: Record<string, string> = {}

	if (status && !NOTE_STATUSES.has(status)) {
		fields.status = 'Status is invalid.'
	}

	if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
		fields.releaseDate = 'Release date must be YYYY-MM-DD.'
	}

	if (Object.keys(fields).length > 0) {
		throw fieldError(fields)
	}

	return {
		...(title ? { title } : {}),
		...(status ? { status: status as NewsroomNoteStatus } : {}),
		...(releaseDate ? { releaseDate } : {}),
		...(topicId ? { topicId } : {}),
	}
}

export const escapeRegex = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export type PublishableChange = {
	title: string
	type?: string
	description: string
	image: string
	topicId: string
}

export type PublishableNote = {
	title: string
	description: string
	version: string
	releaseDateTime?: Date | null
	changes: PublishableChange[]
}

export const assertReleaseNoteComplete = (note: PublishableNote): void => {
	const fields: Record<string, string> = {}

	if (!note.title.trim()) fields.title = 'Title is required.'

	if (!note.description.trim()) fields.description = 'Description is required.'

	if (!note.version.trim()) fields.version = 'Version is required.'

	if (!note.releaseDateTime) {
		fields.releaseDateTime = 'Publication date/time is required.'
	}

	if (note.changes.length < 1) {
		fields.changes = 'At least one change is required.'
	}

	note.changes.forEach((change, index) => {
		if (!change.title.trim()) {
			fields[`changes.${index}.title`] = 'Change title is required.'
		}

		if (!change.type || !CHANGE_TYPES.has(change.type)) {
			fields[`changes.${index}.type`] = 'Change type is required.'
		}

		if (!change.description.trim()) {
			fields[`changes.${index}.description`] = 'Change description is required.'
		}

		if (!change.image.trim()) {
			fields[`changes.${index}.image`] = 'Change image is required.'
		}

		if (!change.topicId.trim()) {
			fields[`changes.${index}.topicId`] = 'Change topic is required.'
		}
	})

	if (Object.keys(fields).length > 0) {
		throw fieldError(fields)
	}
}

export const assertReleaseNoteEditable = (status: string): void => {
	if (status === NEWSROOM_NOTE_STATUS.PUBLISHED) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			'Unpublish the release note before editing.',
		)
	}
}

export const isNewsroomPubliclyVisible = (
	status: string,
	releaseDateTime: Date | null | undefined,
	now = new Date(),
): boolean =>
	status === NEWSROOM_NOTE_STATUS.PUBLISHED &&
	releaseDateTime != null &&
	releaseDateTime.getTime() <= now.getTime()

export const publicReleaseNoteFilter = (now = new Date()) => ({
	status: NEWSROOM_NOTE_STATUS.PUBLISHED,
	releaseDateTime: { $lte: now },
})

export const isNewsroomUnread = (
	releaseDateTime: Date,
	lastVisitedAt?: Date | null,
): boolean =>
	lastVisitedAt == null || releaseDateTime.getTime() > lastVisitedAt.getTime()

export const selectPublicNewsroomNotes = <
	T extends { status: string; releaseDateTime?: Date | null },
>(
	notes: T[],
	now = new Date(),
): T[] =>
	notes.filter(note =>
		isNewsroomPubliclyVisible(note.status, note.releaseDateTime, now),
	)

export const countUnreadNewsroomNotes = (
	notes: { status: string; releaseDateTime?: Date | null }[],
	lastVisitedAt?: Date | null,
	now = new Date(),
): number =>
	selectPublicNewsroomNotes(notes, now).filter(
		note =>
			note.releaseDateTime != null &&
			isNewsroomUnread(note.releaseDateTime, lastVisitedAt),
	).length

export const pinnedIdsForUser = (
	rows: { userId: string; newsroomItemId: string; pinned?: boolean }[],
	userId: string,
): string[] =>
	rows
		.filter(
			row =>
				row.userId === userId &&
				row.pinned === true &&
				row.newsroomItemId !== NEWSROOM_FEED_STATE_ID,
		)
		.map(row => row.newsroomItemId)

export const parseFeedFilters = (query: {
	title?: unknown
	topicId?: unknown
	pinned?: unknown
}): { title?: string; topicId?: string; pinned?: boolean } => {
	const title = optionalString(query.title)
	const topicId = optionalString(query.topicId)
	const pinnedRaw = optionalString(query.pinned)
	const fields: Record<string, string> = {}

	if (pinnedRaw && pinnedRaw !== 'true' && pinnedRaw !== 'false') {
		fields.pinned = 'Pinned must be true or false.'
	}

	if (Object.keys(fields).length > 0) {
		throw fieldError(fields)
	}

	return {
		...(title ? { title } : {}),
		...(topicId ? { topicId } : {}),
		...(pinnedRaw === 'true' ? { pinned: true } : {}),
	}
}
