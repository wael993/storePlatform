import { mkdtemp, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

import { getDb } from '../../db'
import {
	acquireRestoreLock,
	BACKUP_KIND,
	BACKUP_STATUS,
	BackupJob,
	BackupKind,
	BackupStatus,
	Connections,
	deleteBackupJob,
	deleteOldFailedBackups,
	enqueueBackupJob,
	expiredBackups,
	getBackupState,
	heartbeatRestoreLock,
	recordBackupCompleted,
	replaceTenantRows,
	saveProviderConfig,
	setRestoreState,
	tenantRows,
	updateBackupJob,
	updateBackupState,
	withSnapshot,
	bumpDataVersion,
	releaseRestoreLock,
	RestoreState,
} from '../../db/repos/backups'
import { tenants } from '../../db/schema'
import { redisCache } from '../cache/redisCache'
import logger from '../logger/logger'
import { invalidateSeeCache } from '../seePermissions'
import {
	BACKUP_FORMAT_VERSION,
	BackupManifest,
	decryptArchive,
	parseRowLine,
	readArchive,
	rowLine,
	writeArchive,
} from './archive'
import {
	BACKUP_HEARTBEAT_MS,
	BACKUP_MAX_RUN_MS,
	DEFAULT_BACKUP_RETENTION,
	isRestoreLockLive,
} from './constants'
import { BackupConnection, getDriver } from './drivers'
import { BackupError, backupErrorCode } from './errors'
import { BACKUP_SCHEMA_FINGERPRINT, BACKUP_TABLES } from './tables'

const FAILED_HISTORY_MS = 30 * 24 * 60 * 60 * 1000
const APPLICATION_VERSION = process.env.npm_package_version ?? 'unknown'

const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
	const dir = await mkdtemp(join(tmpdir(), 'tenant-backup-'))

	try {
		return await run(dir)
	} finally {
		await rm(dir, { recursive: true, force: true })
	}
}

/**
 * Runs `work` while `beat` refreshes its heartbeat. Beating stops after BACKUP_MAX_RUN_MS,
 * so a run that hangs goes stale like a crashed one.
 */
const withHeartbeat = async <T>(
	beat: () => Promise<unknown>,
	work: () => Promise<T>,
): Promise<T> => {
	const startedAt = Date.now()
	const timer = setInterval(() => {
		if (Date.now() - startedAt < BACKUP_MAX_RUN_MS) {
			beat().catch(error => logger.warn(`Backup heartbeat failed: ${error}`))
		}
	}, BACKUP_HEARTBEAT_MS)

	timer.unref()

	try {
		return await work()
	} finally {
		clearInterval(timer)
	}
}

const loadTenant = async (tenantId: string) =>
	(
		await getDb()
			.select({
				name: tenants.name,
				backupRetentionCount: tenants.backupRetentionCount,
				backupRestoreHeartbeatAt: tenants.backupRestoreHeartbeatAt,
			})
			.from(tenants)
			.where(eq(tenants.tenantId, tenantId))
	)[0] ?? null

export const getConnection = async (
	tenantId: string,
	provider: string,
): Promise<BackupConnection> => {
	const state = await getBackupState(tenantId)
	const stored = (state?.connections as Connections | undefined)?.[provider]

	if (!stored) {
		throw new BackupError(
			'PROVIDER_NOT_CONNECTED',
			`Tenant ${tenantId} has no ${provider} connection.`,
		)
	}

	return {
		tenantId,
		config: stored.config,
		save: config => saveProviderConfig(tenantId, provider, config),
	}
}

const backupName = (tenantName: string, kind: BackupKind, at: Date): string => {
	const safeName = tenantName.replace(/[\\/:*?"<>|\s]+/g, '_')
	const stamp = at
		.toISOString()
		.slice(0, 16)
		.replace('T', '_')
		.replace(':', '-')

	return `${safeName}_${stamp}${kind === BACKUP_KIND.SAFETY ? '_safety' : ''}.backup`
}

/** Queues a backup for one tenant; returns the in-flight job instead of a duplicate. */
export const enqueueBackup = (
	tenantId: string,
	tenantName: string,
	provider: string,
	kind: BackupKind,
	status:
		| typeof BACKUP_STATUS.PENDING
		| typeof BACKUP_STATUS.PROCESSING = BACKUP_STATUS.PENDING,
): Promise<BackupJob> =>
	enqueueBackupJob({
		id: uuidv4(),
		tenantId,
		name: backupName(tenantName, kind, new Date()),
		provider,
		kind,
		status,
	})

async function* archiveLines(
	tx: Parameters<Parameters<typeof withSnapshot>[0]>[0],
	tenantId: string,
	manifest: BackupManifest,
): AsyncGenerator<string> {
	yield `${JSON.stringify(manifest)}\n`

	for await (const row of tenantRows(tx, tenantId)) {
		yield rowLine(row.table, row.json)
	}
}

/** Writes one tenant's encrypted archive to `file`; returns the dataVersion it covers. */
export const writeTenantArchive = async (
	tenantId: string,
	tenantName: string,
	file: string,
): Promise<number> =>
	withSnapshot(async tx => {
		// read inside the snapshot: a write after it bumps the version, so it is backed up next run
		const dataVersion = (await getBackupState(tenantId, tx))?.dataVersion ?? 0
		// now() = transaction start, never after the snapshot: a restore drops sync records from here on.
		// Kept as text at full microsecond precision: a JS Date would round it to milliseconds.
		const {
			rows: [{ at: snapshotAt }],
		} = await tx.execute<{ at: string }>(
			sql`select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at`,
		)

		await writeArchive(
			tenantId,
			archiveLines(tx, tenantId, {
				backupVersion: BACKUP_FORMAT_VERSION,
				schemaFingerprint: BACKUP_SCHEMA_FINGERPRINT,
				tenantId,
				tenantName,
				createdAt: new Date().toISOString(),
				snapshotAt,
				applicationVersion: APPLICATION_VERSION,
				dataVersion,
				tables: BACKUP_TABLES.map(table => table.name),
			}),
			file,
		)

		return dataVersion
	})

const staleJob = () =>
	new BackupError(
		'WORKER_TIMEOUT',
		'Job was failed as stale while it still ran.',
	)

const markFailed = async (
	job: BackupJob,
	error: unknown,
	fallbackCode: string,
) => {
	const errorCode = backupErrorCode(error, fallbackCode)

	logger.error(
		`Backup ${job.id} (tenant ${job.tenantId}) failed: ${errorCode} ${String(error)}`,
	)

	const recorded = await updateBackupJob(job.id, {
		status: BACKUP_STATUS.FAILED,
		completedAt: new Date(),
		errorCode,
		errorMessage: String(error).slice(0, 2000),
	})

	// a row already failed as stale: a newer job may have completed since, keep its status.
	// lastBackupVersion stays untouched so the tenant is retried next run
	if (recorded)
		await updateBackupState(job.tenantId, { lastBackupStatus: 'FAILED' })
}

/**
 * Runs one claimed job end to end. Never throws; returns the final status.
 * Same path for scheduled, manual and safety backups.
 */
export const processBackup = async (job: BackupJob): Promise<BackupStatus> => {
	const { tenantId } = job
	let stage = 'DATABASE_ERROR'

	try {
		const tenant = await loadTenant(tenantId)

		if (!tenant)
			throw new BackupError('TENANT_VALIDATION_ERROR', 'Tenant not found.')

		if (
			job.kind !== BACKUP_KIND.SAFETY &&
			isRestoreLockLive(tenant.backupRestoreHeartbeatAt)
		) {
			throw new BackupError('RESTORE_IN_PROGRESS', 'Restore running; skipped.')
		}

		const connection = await getConnection(tenantId, job.provider)
		const driver = getDriver(job.provider)

		// updateBackupJob({}) only touches updated_at, the job's heartbeat
		await withHeartbeat(
			() => updateBackupJob(job.id, {}),
			() =>
				withTempDir(async dir => {
					const file = join(dir, 'archive')

					stage = 'BACKUP_SERIALIZATION_ERROR'
					const dataVersion = await writeTenantArchive(
						tenantId,
						tenant.name,
						file,
					)

					stage = 'UPLOAD_ERROR'

					if (
						!(await updateBackupJob(job.id, {
							status: BACKUP_STATUS.UPLOADING,
							dataVersion,
						}))
					) {
						throw staleJob()
					}

					const { size } = await stat(file)
					const uploaded = await driver.upload(connection, job.name, file)

					if (uploaded.size !== size) {
						throw new BackupError(
							'UPLOAD_ERROR',
							`Uploaded size ${uploaded.size} != local ${size}`,
						)
					}

					const completedAt = new Date()

					if (
						!(await updateBackupJob(job.id, {
							status: BACKUP_STATUS.COMPLETED,
							storageId: uploaded.storageId,
							size,
							completedAt,
						}))
					) {
						// no record owns this file any more: retention would never delete it
						await driver
							.remove(connection, uploaded.storageId)
							.catch(() => undefined)

						throw staleJob()
					}

					await recordBackupCompleted(tenantId, dataVersion, completedAt)
				}),
		)
	} catch (error) {
		await markFailed(job, error, stage).catch(err =>
			logger.error(`Backup ${job.id}: could not record failure: ${err}`),
		)

		return BACKUP_STATUS.FAILED
	}

	// not after a safety backup: it could delete the very backup the restore is about to apply
	if (job.kind !== BACKUP_KIND.SAFETY) {
		await applyRetention(tenantId).catch(error =>
			logger.error(`Backup retention for tenant ${tenantId} failed: ${error}`),
		)
	}

	return BACKUP_STATUS.COMPLETED
}

/** Keeps the newest N successful backups; deletes older files through each backup's own provider. */
export const applyRetention = async (tenantId: string): Promise<void> => {
	await deleteOldFailedBackups(
		tenantId,
		new Date(Date.now() - FAILED_HISTORY_MS),
	)

	const tenant = await loadTenant(tenantId)

	// a running restore may still download any of them; the next backup retries
	if (isRestoreLockLive(tenant?.backupRestoreHeartbeatAt)) return

	const keep = tenant?.backupRetentionCount ?? DEFAULT_BACKUP_RETENTION

	for (const backup of await expiredBackups(tenantId, keep)) {
		try {
			await getDriver(backup.provider).remove(
				await getConnection(tenantId, backup.provider),
				backup.storageId as string,
			)

			await deleteBackupJob(backup.id)
		} catch (error) {
			// e.g. provider disconnected: keep the record, try again after the next backup
			logger.warn(`Retention: could not delete backup ${backup.id}: ${error}`)
		}
	}
}

/** Checks manifest, schema and that every row is a known table of this tenant. Reads only. */
export const validateArchive = async (
	tenantId: string,
	plainPath: string,
): Promise<BackupManifest> => {
	const known = new Set(BACKUP_TABLES.map(table => table.name))
	let manifest: BackupManifest | undefined

	for await (const line of readArchive(plainPath)) {
		if (!manifest) {
			manifest = JSON.parse(line) as BackupManifest

			if (manifest.backupVersion !== BACKUP_FORMAT_VERSION) {
				throw new BackupError(
					'RESTORE_VALIDATION_ERROR',
					'Unsupported backup version.',
				)
			}

			if (manifest.tenantId !== tenantId) {
				throw new BackupError(
					'TENANT_VALIDATION_ERROR',
					'Backup belongs to another tenant.',
				)
			}

			if (manifest.schemaFingerprint !== BACKUP_SCHEMA_FINGERPRINT) {
				throw new BackupError(
					'RESTORE_VALIDATION_ERROR',
					'Backup was made with another database structure.',
				)
			}

			continue
		}

		const { table, json } = parseRowLine(line)

		if (!known.has(table)) {
			throw new BackupError(
				'RESTORE_VALIDATION_ERROR',
				`Unknown table ${table}.`,
			)
		}

		// parsed only to read tenant_id; the row text itself goes to Postgres unchanged
		if ((JSON.parse(json) as { tenant_id?: unknown }).tenant_id !== tenantId) {
			throw new BackupError(
				'TENANT_VALIDATION_ERROR',
				`Foreign row in ${table}.`,
			)
		}
	}

	if (!manifest)
		throw new BackupError('RESTORE_VALIDATION_ERROR', 'Empty backup.')

	return manifest
}

async function* archiveRows(plainPath: string) {
	let first = true

	for await (const line of readArchive(plainPath)) {
		if (first) {
			first = false

			continue
		}

		yield parseRowLine(line)
	}
}

/** Replaces the tenant's data with a validated archive in one transaction, under the lock `lockedAt`. */
export const applyArchive = (
	tenantId: string,
	plainPath: string,
	lockedAt: Date,
	manifest: BackupManifest,
) =>
	replaceTenantRows(
		tenantId,
		() => archiveRows(plainPath),
		lockedAt,
		manifest.snapshotAt ?? manifest.createdAt,
	)

export type RestoreRun = { lockedAt: Date; state: RestoreState }

/**
 * Takes the tenant write lock and records RUNNING, so the caller's response already
 * reflects the restore. Null while another restore runs. Then call `restoreBackup`.
 */
export const beginRestore = async (
	tenantId: string,
	backupId: string,
): Promise<RestoreRun | null> => {
	const lockedAt = await acquireRestoreLock(tenantId)

	if (!lockedAt) return null

	// startedAt = lock token: later status writes only touch this restore's record
	const state: RestoreState = {
		status: 'RUNNING',
		backupId,
		startedAt: lockedAt.toISOString(),
	}

	try {
		await updateBackupState(tenantId, { restore: state })
	} catch (error) {
		await releaseRestoreLock(tenantId, lockedAt)

		throw error
	}

	return { lockedAt, state }
}

/**
 * Restore flow: download (backup's own provider) → decrypt + integrity check → validate
 * manifest and every row's tenant → safety backup (active provider) → replace data in
 * one transaction. `run` comes from `beginRestore`; the lock is kept alive by a heartbeat
 * and released here.
 */
export const restoreBackup = async (
	tenantId: string,
	backup: BackupJob,
	activeProvider: string,
	{ lockedAt, state: restore }: RestoreRun,
): Promise<void> => {
	let stage = 'RESTORE_ERROR'
	const beat = async () => {
		if (!(await heartbeatRestoreLock(tenantId, lockedAt))) {
			logger.warn(
				`Restore of tenant ${tenantId} lost its lock; it will roll back.`,
			)
		}
	}

	try {
		await withHeartbeat(beat, () =>
			withTempDir(async dir => {
				const encrypted = join(dir, 'archive')
				const plain = join(dir, 'plain')

				stage = 'DOWNLOAD_ERROR'
				await getDriver(backup.provider).download(
					await getConnection(tenantId, backup.provider),
					backup.storageId as string,
					encrypted,
				)

				stage = 'RESTORE_VALIDATION_ERROR'
				await decryptArchive(tenantId, encrypted, plain)
				const manifest = await validateArchive(tenantId, plain)

				const tenant = await loadTenant(tenantId)
				const safety = await enqueueBackup(
					tenantId,
					tenant?.name ?? tenantId,
					activeProvider,
					BACKUP_KIND.SAFETY,
					BACKUP_STATUS.PROCESSING,
				)

				restore.safetyBackupId = safety.id
				await setRestoreState(tenantId, restore)

				if ((await processBackup(safety)) !== BACKUP_STATUS.COMPLETED) {
					throw new BackupError(
						'SAFETY_BACKUP_FAILED',
						'Safety backup failed; restore aborted.',
					)
				}

				stage = 'RESTORE_ERROR'
				await applyArchive(tenantId, plain, lockedAt, manifest)
			}),
		)

		restore.status = 'COMPLETED'
		logger.info(
			`Restore of backup ${backup.id} for tenant ${tenantId} completed.`,
		)
	} catch (error) {
		restore.status = 'FAILED'
		restore.errorCode = backupErrorCode(error, stage)
		logger.error(
			`Restore of backup ${backup.id} for tenant ${tenantId} failed: ${restore.errorCode} ${error}`,
		)
	} finally {
		restore.finishedAt = new Date().toISOString()
		await setRestoreState(tenantId, restore).catch(error =>
			logger.error(`Restore state for tenant ${tenantId} not saved: ${error}`),
		)

		// a failed restore rolled back: data, cache and dataVersion are unchanged
		if (restore.status === 'COMPLETED') {
			// restored data differs from the current state: the next scheduled run backs it up
			await bumpDataVersion(tenantId).catch(() => undefined)
			await redisCache.invalidate(tenantId).catch(() => undefined)

			// role permissions were restored too (other instances: cache TTL, 60 s)
			invalidateSeeCache(tenantId)
		}

		await releaseRestoreLock(tenantId, lockedAt)
	}
}
