import { sql } from 'drizzle-orm'
import {
	boolean,
	index,
	integer,
	jsonb,
	pgSchema,
	text,
	uniqueIndex,
} from 'drizzle-orm/pg-core'
import { audit, docId, tz, timestamps } from './columns'

/** Global data: not tenant business data (same split as backup include/exclude). */
export const platform = pgSchema('platform')

export const tenants = platform.table('tenants', {
	...docId,
	tenantId: text().notNull().unique(),
	name: text().notNull(),
	domain: text().notNull().unique(),
	status: text().notNull(),
	accessiblePages: text()
		.array()
		.notNull()
		.default(sql`'{}'`),
	offlineEnabled: boolean().notNull().default(true),
	invoiceAiMonthlyLimit: integer(),
	invoiceAiActivatedAt: tz(),
	invoiceAiPeriodStart: tz(),
	invoiceAiUsedInPeriod: integer(),
	invoiceAiCarryOver: integer(),
	productImportStatus: text(),
	backupRetentionCount: integer(), // set by the parked backup feature (stash); kept for when it returns
	subscriptionStartDate: tz(),
	subscriptionRenewalDate: tz(),
	subscriptionStatus: text(),
	subscriptionRenewalEnabled: boolean(),
	subscriptionLastRenewalDate: tz(),
	subscriptionNotifiedForDate: text(),
	subscriptionCreatedAt: tz(),
	subscriptionUpdatedAt: tz(),
	...timestamps,
})

export const users = platform.table(
	'users',
	{
		...docId,
		tenantId: text().notNull(),
		userId: text().notNull(),
		displayName: text().notNull(),
		firstName: text(),
		lastName: text(),
		email: text().notNull(),
		password: text().notNull(),
		role: text().notNull(),
		tokenVersion: integer(),
		avatarColorId: integer(),
		warehouseIds: text().array(),
		...audit,
		...timestamps,
	},
	t => [
		uniqueIndex().on(t.tenantId, t.email),
		uniqueIndex().on(t.tenantId, t.userId),
		uniqueIndex().on(t.tenantId, t.displayName),
	],
)

export const refreshTokens = platform.table(
	'refresh_tokens',
	{
		...docId,
		tenantId: text(),
		userId: text().notNull(), // users.id (was ObjectId ref)
		tokenHash: text().notNull().unique(),
		ip: text(),
		userAgent: text(),
		expiresAt: tz().notNull(),
		...timestamps,
	},
	t => [index().on(t.tenantId, t.userId)],
)

export const roles = platform.table('roles', {
	id: text().primaryKey(), // uppercase role key, not an ObjectId
	name: text().notNull(),
	resources: jsonb().notNull().default({}),
	include: text()
		.array()
		.notNull()
		.default(sql`'{}'`),
	frontendResources: jsonb().notNull().default({}),
	...timestamps,
})

export const subscriptionPaymentSettings = platform.table(
	'subscription_payment_settings',
	{
		...docId,
		settingsId: text().notNull().unique(),
		contactName: text().notNull().default(''),
		contactEmail: text().notNull().default(''),
		contactPhone: text().notNull().default(''),
		methods: jsonb().notNull().default([]),
		...timestamps,
	},
)

export const subscriptionRenewalRequests = platform.table(
	'subscription_renewal_requests',
	{
		...docId,
		requestId: text().notNull().unique(),
		tenantId: text().notNull(),
		tenantName: text(),
		requestedById: text().notNull(),
		requestedByName: text().notNull(),
		currentExpirationDate: tz().notNull(),
		status: text().notNull(),
		requestedAt: tz().notNull(),
		reviewedAt: tz(),
		reviewedById: text(),
		reviewedByName: text(),
		rejectionReason: text(),
		...timestamps,
	},
	t => [
		uniqueIndex()
			.on(t.tenantId)
			.where(sql`${t.status} = 'pending'`),
	],
)

export const newsroomTopics = platform.table('newsroom_topics', {
	...docId,
	topicId: text().notNull().unique(),
	name: text().notNull(),
	nameKey: text().notNull().unique(),
	...timestamps,
})

export const newsroomReleaseNotes = platform.table(
	'newsroom_release_notes',
	{
		...docId,
		releaseNoteId: text().notNull().unique(),
		title: text().notNull(),
		description: text().notNull().default(''),
		version: text().notNull().default(''),
		contentType: text().notNull().default('release_note'),
		status: text().notNull(),
		releaseDateTime: tz(),
		releaseDate: text(),
		...audit,
		...timestamps,
	},
	t => [index().on(t.status, t.releaseDateTime)],
)

export const newsroomChanges = platform.table(
	'newsroom_changes',
	{
		...docId,
		changeId: text().notNull().unique(),
		releaseNoteId: text().notNull(),
		title: text().notNull().default(''),
		type: text(),
		description: text().notNull().default(''),
		image: text().notNull().default(''),
		topicId: text().notNull().default(''),
		sortOrder: integer().notNull().default(0),
		...timestamps,
	},
	t => [index().on(t.releaseNoteId), index().on(t.topicId)],
)

export const newsroomUserStates = platform.table(
	'newsroom_user_states',
	{
		...docId,
		userId: text().notNull(),
		newsroomItemId: text().notNull(),
		pinned: boolean().notNull().default(false),
		lastVisitedAt: tz(),
		acknowledged: boolean().notNull().default(false),
		...timestamps,
	},
	t => [uniqueIndex().on(t.userId, t.newsroomItemId)],
)
