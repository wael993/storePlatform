import { and, asc, desc, eq, inArray, lt, ne, not, sql } from 'drizzle-orm'

import { DbTx, Executor, getDb, inTransaction, requireTenantId } from '..'
import { tenantBackups, tenantBackupStates, tenants } from '../schema'
import { BackupRow } from '../../shared/backup/archive'
import { BACKUP_STALE_MS } from '../../shared/backup/constants'
import { BackupError } from '../../shared/backup/errors'
import { BACKUP_TABLES } from '../../shared/backup/tables'

export const BACKUP_STATUS = {
	PENDING: 'PENDING',
	PROCESSING: 'PROCESSING',
	UPLOADING: 'UPLOADING',
	COMPLETED: 'COMPLETED',
	FAILED: 'FAILED',
} as const

export type BackupStatus = (typeof BACKUP_STATUS)[keyof typeof BACKUP_STATUS]

export const BACKUP_KIND = {
	SCHEDULED: 'scheduled',
	MANUAL: 'manual',
	SAFETY: 'safety',
} as const

export type BackupKind = (typeof BACKUP_KIND)[keyof typeof BACKUP_KIND]

export type BackupJob = typeof tenantBackups.$inferSelect
export type BackupState = typeof tenantBackupStates.$inferSelect

export type ProviderConnection = {
	/** Driver-owned; secrets inside are encrypted by the driver. */
	config: Record<string, unknown>
	accountLabel: string
	connectedAt: string
}
export type Connections = Record<string, ProviderConnection>

export type RestoreState = {
	status: 'RUNNING' | 'COMPLETED' | 'FAILED'
	backupId: string
	safetyBackupId?: string
	startedAt: string
	finishedAt?: string
	errorCode?: string
}

const IN_FLIGHT = [
	BACKUP_STATUS.PENDING,
	BACKUP_STATUS.PROCESSING,
	BACKUP_STATUS.UPLOADING,
]

const staleBefore = () => new Date(Date.now() - BACKUP_STALE_MS)

/** SQL: the tenant's restore heartbeat is fresh (a restore runs; writes are blocked). */
const restoreLockLive = () =>
	sql`coalesce(${tenants.backupRestoreHeartbeatAt} > ${staleBefore()}, false)`

// --- state -------------------------------------------------------------------

export const getBackupState = async (
	tenantId: string,
	db: Executor = getDb(),
): Promise<BackupState | null> =>
	(
		await db
			.select()
			.from(tenantBackupStates)
			.where(eq(tenantBackupStates.tenantId, requireTenantId(tenantId)))
	)[0] ?? null

/** Creates the state row on first use. */
export const updateBackupState = async (
	tenantId: string,
	set: Partial<Omit<BackupState, 'tenantId' | 'createdAt'>>,
	db: Executor = getDb(),
) => {
	await db
		.insert(tenantBackupStates)
		.values({ tenantId: requireTenantId(tenantId), ...set })
		.onConflictDoUpdate({
			target: tenantBackupStates.tenantId,
			set: { ...set, updatedAt: new Date() },
		})
}

/** One provider's entry in `connections` (null removes it), in one statement. */
export const setProviderConnection = async (
	tenantId: string,
	provider: string,
	connection: ProviderConnection | null,
	set: Partial<Pick<BackupState, 'provider' | 'enabled'>> = {},
) => {
	const connections = connection
		? sql`coalesce(${tenantBackupStates.connections}, '{}'::jsonb) || jsonb_build_object(${provider}::text, ${JSON.stringify(connection)}::jsonb)`
		: sql`coalesce(${tenantBackupStates.connections}, '{}'::jsonb) - ${provider}::text`

	await getDb()
		.insert(tenantBackupStates)
		.values({
			tenantId: requireTenantId(tenantId),
			connections: connection ? { [provider]: connection } : {},
			...set,
		})
		.onConflictDoUpdate({
			target: tenantBackupStates.tenantId,
			set: { connections, ...set, updatedAt: new Date() },
		})
}

/** Keeps a rotated provider token (drivers call this through `connection.save`). */
export const saveProviderConfig = async (
	tenantId: string,
	provider: string,
	config: Record<string, unknown>,
) => {
	await getDb()
		.update(tenantBackupStates)
		.set({
			connections: sql`jsonb_set(${tenantBackupStates.connections}, ${`{${provider},config}`}::text[], ${JSON.stringify(config)}::jsonb)`,
			updatedAt: new Date(),
		})
		.where(eq(tenantBackupStates.tenantId, requireTenantId(tenantId)))
}

/** One business operation changed tenant data: the next scheduled run backs it up. */
export const bumpDataVersion = async (tenantId: string) => {
	await getDb()
		.insert(tenantBackupStates)
		.values({ tenantId: requireTenantId(tenantId), dataVersion: 1 })
		.onConflictDoUpdate({
			target: tenantBackupStates.tenantId,
			set: { dataVersion: sql`${tenantBackupStates.dataVersion} + 1` },
		})
}

/** Updates this restore's record only: a newer restore's status is never overwritten. */
export const setRestoreState = async (tenantId: string, restore: RestoreState) => {
	await getDb()
		.update(tenantBackupStates)
		.set({ restore, updatedAt: new Date() })
		.where(
			and(
				eq(tenantBackupStates.tenantId, requireTenantId(tenantId)),
				sql`${tenantBackupStates.restore}->>'startedAt' = ${restore.startedAt}`,
			),
		)
}

/** After an upload: `max` in SQL, so two jobs finishing together never lower it. */
export const recordBackupCompleted = async (
	tenantId: string,
	dataVersion: number,
	at: Date,
) => {
	await getDb()
		.update(tenantBackupStates)
		.set({
			lastBackupVersion: sql`greatest(${tenantBackupStates.lastBackupVersion}, ${dataVersion})`,
			lastBackupAt: at,
			lastBackupStatus: 'COMPLETED',
			updatedAt: new Date(),
		})
		.where(eq(tenantBackupStates.tenantId, requireTenantId(tenantId)))
}

/** Single use: true only for the tenant's current OAuth nonce, cleared in the same statement. */
export const consumeOAuthNonce = async (tenantId: string, nonce: string) =>
	(
		await getDb()
			.update(tenantBackupStates)
			.set({ oauthNonce: null, updatedAt: new Date() })
			.where(
				and(
					eq(tenantBackupStates.tenantId, requireTenantId(tenantId)),
					eq(tenantBackupStates.oauthNonce, nonce),
				),
			)
			.returning({ tenantId: tenantBackupStates.tenantId })
	).length === 1

// --- jobs ----------------------------------------------------------------------

/** Queues a job; a scheduled / manual one returns the tenant's in-flight job instead of a duplicate. */
export const enqueueBackupJob = async (job: {
	id: string
	tenantId: string
	name: string
	provider: string
	kind: BackupKind
	status: typeof BACKUP_STATUS.PENDING | typeof BACKUP_STATUS.PROCESSING
}): Promise<BackupJob> => {
	// two tries: the in-flight job can finish between our insert and our select
	for (let attempt = 0; attempt < 2; attempt++) {
		const [created] = await getDb()
			.insert(tenantBackups)
			.values({
				...job,
				tenantId: requireTenantId(job.tenantId),
				startedAt: job.status === BACKUP_STATUS.PROCESSING ? new Date() : null,
			})
			.onConflictDoNothing() // the partial unique index `tenant_backups_one_in_flight`
			.returning()

		if (created) return created

		const [inFlight] = await getDb()
			.select()
			.from(tenantBackups)
			.where(
				and(
					eq(tenantBackups.tenantId, job.tenantId),
					ne(tenantBackups.kind, BACKUP_KIND.SAFETY),
					inArray(tenantBackups.status, IN_FLIGHT),
				),
			)

		if (inFlight) return inFlight
	}

	throw new Error('Backup job neither created nor in flight.')
}

/** Claims the oldest PENDING job; SKIP LOCKED keeps two workers from taking the same one. */
export const claimNextBackupJob = async (): Promise<BackupJob | null> => {
	const result = await getDb().execute<Record<string, unknown>>(sql`
		update ${tenantBackups} set status = ${BACKUP_STATUS.PROCESSING}, started_at = now(), updated_at = now()
		where id = (
			select id from ${tenantBackups} where status = ${BACKUP_STATUS.PENDING}
			order by created_at limit 1 for update skip locked
		)
		returning id`)
	const id = result.rows[0]?.id as string | undefined

	return id ? getBackupJob(id) : null
}

export const getBackupJob = async (id: string): Promise<BackupJob | null> =>
	(await getDb().select().from(tenantBackups).where(eq(tenantBackups.id, id)))[0] ??
	null

/**
 * Moves an in-flight job on. False when the row is already final (e.g. failed as stale
 * while this worker hung): the caller must drop its result, never overwrite the row.
 */
export const updateBackupJob = async (
	id: string,
	set: Partial<Omit<BackupJob, 'id' | 'tenantId' | 'createdAt'>>,
): Promise<boolean> =>
	(
		await getDb()
			.update(tenantBackups)
			.set({ ...set, updatedAt: new Date() })
			.where(
				and(eq(tenantBackups.id, id), inArray(tenantBackups.status, IN_FLIGHT)),
			)
			.returning({ id: tenantBackups.id })
	).length === 1

/** Jobs whose worker stopped beating (crash, deploy, hang past the cap) fail, so the tenant is retried. */
export const failStaleBackupJobs = async () => {
	await getDb()
		.update(tenantBackups)
		.set({
			status: BACKUP_STATUS.FAILED,
			errorCode: 'WORKER_TIMEOUT',
			completedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(
			and(
				inArray(tenantBackups.status, [
					BACKUP_STATUS.PROCESSING,
					BACKUP_STATUS.UPLOADING,
				]),
				lt(tenantBackups.updatedAt, staleBefore()),
			),
		)
}

export const listBackupJobs = (tenantId: string, limit: number) =>
	getDb()
		.select()
		.from(tenantBackups)
		.where(eq(tenantBackups.tenantId, requireTenantId(tenantId)))
		.orderBy(desc(tenantBackups.createdAt))
		.limit(limit)

export const findCompletedBackup = async (
	tenantId: string,
	backupId: string,
): Promise<BackupJob | null> =>
	(
		await getDb()
			.select()
			.from(tenantBackups)
			.where(
				and(
					eq(tenantBackups.tenantId, requireTenantId(tenantId)),
					eq(tenantBackups.id, backupId),
					eq(tenantBackups.status, BACKUP_STATUS.COMPLETED),
				),
			)
	)[0] ?? null

/**
 * Completed backups beyond the newest `keep` (retention deletes their files). Safety
 * backups are ranked on their own, so restores never push regular backups out.
 */
export const expiredBackups = async (tenantId: string, keep: number) => {
	const beyondKeep = (safety: boolean) =>
		getDb()
			.select()
			.from(tenantBackups)
			.where(
				and(
					eq(tenantBackups.tenantId, requireTenantId(tenantId)),
					eq(tenantBackups.status, BACKUP_STATUS.COMPLETED),
					safety
						? eq(tenantBackups.kind, BACKUP_KIND.SAFETY)
						: ne(tenantBackups.kind, BACKUP_KIND.SAFETY),
				),
			)
			.orderBy(desc(tenantBackups.completedAt))
			.offset(keep)

	return [...(await beyondKeep(false)), ...(await beyondKeep(true))]
}

export const deleteBackupJob = async (id: string) => {
	await getDb().delete(tenantBackups).where(eq(tenantBackups.id, id))
}

/** Failed jobs own no file; they stay a month for the history. */
export const deleteOldFailedBackups = async (tenantId: string, before: Date) => {
	await getDb()
		.delete(tenantBackups)
		.where(
			and(
				eq(tenantBackups.tenantId, requireTenantId(tenantId)),
				eq(tenantBackups.status, BACKUP_STATUS.FAILED),
				lt(tenantBackups.createdAt, before),
			),
		)
}

/**
 * Tenants whose data changed since their last successful backup, with backups on,
 * a provider set, the tenant active and the BACKUP page granted (no tenant data read).
 */
export const dueBackupTenants = async () =>
	getDb()
		.select({
			tenantId: tenantBackupStates.tenantId,
			provider: tenantBackupStates.provider,
			name: tenants.name,
		})
		.from(tenantBackupStates)
		.innerJoin(tenants, eq(tenants.tenantId, tenantBackupStates.tenantId))
		.where(
			and(
				eq(tenantBackupStates.enabled, true),
				sql`${tenantBackupStates.provider} is not null`,
				sql`${tenantBackupStates.dataVersion} > ${tenantBackupStates.lastBackupVersion}`,
				eq(tenants.status, 'active'),
				sql`'BACKUP' = any(${tenants.accessiblePages})`,
				// a job queued now would only fail with RESTORE_IN_PROGRESS
				not(restoreLockLive()),
			),
		)
		.orderBy(asc(tenantBackupStates.tenantId))

// --- restore lock --------------------------------------------------------------

/**
 * Takes the tenant write lock. Returns the owner token (`backupRestoreStartedAt`) that
 * heartbeat, commit check and release must match; null while a live restore holds it.
 */
export const acquireRestoreLock = async (tenantId: string): Promise<Date | null> => {
	const now = new Date()
	const rows = await getDb()
		.update(tenants)
		.set({ backupRestoreStartedAt: now, backupRestoreHeartbeatAt: now })
		.where(and(eq(tenants.tenantId, requireTenantId(tenantId)), not(restoreLockLive())))
		.returning({ tenantId: tenants.tenantId })

	return rows.length === 1 ? now : null
}

const ownsRestoreLock = (tenantId: string, lockedAt: Date) =>
	and(
		eq(tenants.tenantId, requireTenantId(tenantId)),
		eq(tenants.backupRestoreStartedAt, lockedAt),
	)

/** Keeps the lock alive; false when it is no longer this restore's. */
export const heartbeatRestoreLock = async (tenantId: string, lockedAt: Date) =>
	(
		await getDb()
			.update(tenants)
			.set({ backupRestoreHeartbeatAt: new Date() })
			.where(ownsRestoreLock(tenantId, lockedAt))
			.returning({ tenantId: tenants.tenantId })
	).length === 1

/** Releases the lock only if this restore still owns it (never a newer restore's). */
export const releaseRestoreLock = async (tenantId: string, lockedAt: Date) => {
	await getDb()
		.update(tenants)
		.set({ backupRestoreStartedAt: null, backupRestoreHeartbeatAt: null })
		.where(ownsRestoreLock(tenantId, lockedAt))
}

// --- tenant data ---------------------------------------------------------------

const PAGE = 1000

/** `"store"."<name>"`; names come only from BACKUP_TABLES, never from a request or a file. */
const tableSql = (name: string) =>
	sql`${sql.identifier('store')}.${sql.identifier(name)}`

/**
 * Every backed-up row of one tenant, as `row_to_json` text. Must run inside one
 * REPEATABLE READ transaction (see `withSnapshot`), so all pages and tables are one
 * consistent picture: a sale committed meanwhile is either fully in or fully out.
 * One server-side cursor per table = one scan; LIMIT/OFFSET-style paging re-reads the table per page.
 */
export async function* tenantRows(
	tx: DbTx,
	tenantId: string,
): AsyncGenerator<BackupRow> {
	requireTenantId(tenantId)

	for (const { name } of BACKUP_TABLES) {
		await tx.execute(sql`
			declare backup_rows no scroll cursor for
			select row_to_json(t)::text as json from ${tableSql(name)} t
			where t.tenant_id = ${tenantId}`)

		for (;;) {
			const { rows } = await tx.execute<{ json: string }>(
				sql`fetch ${sql.raw(String(PAGE))} from backup_rows`,
			)

			for (const row of rows) yield { table: name, json: row.json }

			if (rows.length < PAGE) break
		}

		await tx.execute(sql`close backup_rows`)
	}
}

/** Runs `work` on one read-only snapshot of the database. */
export const withSnapshot = <T>(work: (tx: DbTx) => Promise<T>): Promise<T> =>
	getDb().transaction(work, {
		isolationLevel: 'repeatable read',
		accessMode: 'read only',
	})

/**
 * Replaces all backed-up rows of one tenant with `rows` in ONE transaction: delete
 * (children first), then insert through `json_populate_recordset`. Any failure rolls
 * back everything, so the tenant keeps its old data. Rows must be validated already.
 */
export const replaceTenantRows = (
	tenantId: string,
	rows: () => AsyncIterable<BackupRow>,
	lockedAt: Date,
): Promise<number> =>
	inTransaction(undefined, async tx => {
		requireTenantId(tenantId)

		for (const { name } of [...BACKUP_TABLES].reverse()) {
			await tx.execute(
				sql`delete from ${tableSql(name)} where tenant_id = ${tenantId}`,
			)
		}

		let inserted = 0
		let expected = 0
		let table = ''
		let batch: string[] = []
		const flush = async () => {
			if (!batch.length) return

			const result = await tx.execute(sql`
				insert into ${tableSql(table)}
				select * from json_populate_recordset(null::${tableSql(table)}, ${`[${batch.join(',')}]`}::json)`)

			inserted += result.rowCount ?? 0
			batch = []
		}

		for await (const row of rows()) {
			if (row.table !== table || batch.length >= PAGE) {
				await flush()
				table = row.table
			}

			batch.push(row.json)
			expected++
		}

		await flush()

		if (inserted !== expected) {
			throw new BackupError(
				'RESTORE_ERROR',
				`Inserted ${inserted} of ${expected} rows.`,
			)
		}

		// commit only under a live lock that is still ours: once it went stale, writes may run again
		const [lock] = await tx
			.select({ tenantId: tenants.tenantId })
			.from(tenants)
			.where(and(ownsRestoreLock(tenantId, lockedAt), restoreLockLive()))

		if (!lock) {
			throw new BackupError('RESTORE_ERROR', 'Restore lock lost; rolled back.')
		}

		return inserted
	})
