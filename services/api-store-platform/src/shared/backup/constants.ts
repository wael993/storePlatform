export const DEFAULT_BACKUP_RETENTION = 3
/** A running backup job or restore refreshes its heartbeat this often. */
export const BACKUP_HEARTBEAT_MS = 30_000
/** No heartbeat for this long = the process died (crash, deploy): job failed, restore lock free. */
export const BACKUP_STALE_MS = 5 * 60 * 1000
/** Hard cap: the heartbeat stops after this, so a hung run goes stale (and a restore rolls back). */
export const BACKUP_MAX_RUN_MS = 2 * 60 * 60 * 1000

/** True while a restore's heartbeat is fresh: tenant writes are blocked. */
export const isRestoreLockLive = (
	heartbeatAt: Date | string | null | undefined,
): boolean =>
	Boolean(heartbeatAt) &&
	Date.now() - new Date(heartbeatAt as Date | string).getTime() <
		BACKUP_STALE_MS

/**
 * A restore rewrote tenant data without bumping updatedAt, so sync deltas since `since`
 * can't express it. finishedAt too: a device that re-downloaded mid-restore must do it once more.
 */
export const restoreChangedSince = (
	restore: { startedAt?: string; finishedAt?: string } | null | undefined,
	since: Date,
): boolean =>
	Math.max(
		restore?.startedAt ? new Date(restore.startedAt).getTime() : 0,
		restore?.finishedAt ? new Date(restore.finishedAt).getTime() : 0,
	) > since.getTime()
