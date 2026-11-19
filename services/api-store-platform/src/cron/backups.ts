import cron from 'node-cron'

import { config } from '../config/config'
import {
	BACKUP_KIND,
	claimNextBackupJob,
	dueBackupTenants,
	failStaleBackupJobs,
} from '../db/repos/backups'
import { BACKUP_MAX_RUN_MS, BACKUP_STALE_MS } from '../shared/backup/constants'
import { enqueueBackup, processBackup } from '../shared/backup/engine'
import logger from '../shared/logger/logger'

const WORKER_POLL_MS = 10_000
let activeWorkers = 0
let draining = false

/**
 * Scheduler: only creates PENDING jobs for tenants whose dataVersion moved since the last
 * successful backup (one query on the small state table, no tenant data read).
 */
export const scheduleDueBackups = async (): Promise<number> => {
	let queued = 0

	for (const due of await dueBackupTenants()) {
		await enqueueBackup(
			due.tenantId,
			due.name,
			due.provider as string, // the query requires a provider
			BACKUP_KIND.SCHEDULED,
		)

		queued++
	}

	return queued
}

/**
 * Worker: claims PENDING jobs (FOR UPDATE SKIP LOCKED, safe across instances) up to the
 * configured concurrency per instance. shortcut: one global limit, no per-provider rate
 * limit; add per-provider caps when a provider starts returning 429s.
 */
const drainQueue = async (): Promise<void> => {
	await failStaleBackupJobs()

	while (activeWorkers < config.backup.workerConcurrency) {
		const job = await claimNextBackupJob()

		if (!job) return

		activeWorkers++
		let released = false
		const release = () => {
			if (!released) activeWorkers--

			released = true
		}
		// a hung job stops beating at the cap and is failed as stale; free its slot then too
		// (its row is final, so the gated updates drop whatever it does later)
		const timer = setTimeout(release, BACKUP_MAX_RUN_MS + BACKUP_STALE_MS)

		timer.unref()
		void processBackup(job).finally(() => {
			clearTimeout(timer)
			release()
		})
	}
}

export function startBackupCron(): void {
	if (!config.backup.masterKey) {
		logger.info('Backup: disabled (set BACKUP_MASTER_KEY to enable)')

		return
	}

	const { timezone } = config.cron

	cron.schedule(
		config.backup.schedule,
		async () => {
			try {
				logger.info(
					`Cron: queued ${await scheduleDueBackups()} tenant backup(s)`,
				)
			} catch (error) {
				logger.error(`Cron: backup scheduling failed: ${error}`)
			}
		},
		{ timezone, noOverlap: true, name: 'tenant-backup-scheduler' },
	)

	const worker = setInterval(() => {
		if (draining) return

		draining = true
		drainQueue()
			.catch(error => logger.error(`Backup worker failed: ${error}`))
			.finally(() => {
				draining = false
			})
	}, WORKER_POLL_MS)

	worker.unref()

	logger.info(
		`Cron: tenant backups scheduled (${config.backup.schedule} ${timezone}, ${config.backup.workerConcurrency} worker(s))`,
	)
}
