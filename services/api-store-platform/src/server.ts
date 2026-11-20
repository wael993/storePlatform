import { closeDb } from './db'
import { config } from './config/config'
import { startTokenCleanupCron } from './cron/cleanExpiredTokens'
import { startNegativeQuantitySnapshotCron } from './cron/snapshotNegativeQuantity'
import { startInvoiceAiUsageRollCron } from './cron/rollInvoiceAiUsage'
import { startSubscriptionLifecycleCron } from './cron/manageSubscriptions'
import { startBackupCron } from './cron/backups'
import { redisCache } from './shared/cache/redisCache'
import logger, { EntityType } from './shared/logger/logger'
import { createApp } from './app'

const app = createApp()

if (config.redis.enabled) {
	redisCache.connect().catch(() => undefined)
} else {
	logger.info(
		'Redis cache not enabled (set REDIS_ENABLED=true with REDIS_HOST and REDIS_PASSWORD)',
		{ entity: EntityType.STORAGE },
	)
}

let lastCacheMetrics = ''
const cacheMetricsInterval = setInterval(() => {
	const stats = redisCache.getStats()
	const line = `Cache ${stats.ready ? 'ready' : 'NOT ready'}: ${stats.hits} hits, ${stats.misses} misses, ${stats.sets} sets, ${stats.dels} deletes, ${stats.errors} errors`

	// counters are cumulative: an unchanged line means no cache traffic, skip it
	if (line === lastCacheMetrics) return

	lastCacheMetrics = line

	logger.log(stats.ready && !stats.errors ? 'info' : 'warn', line, {
		entity: EntityType.STORAGE,
	})
}, 60_000)

cacheMetricsInterval.unref()

startTokenCleanupCron()
startNegativeQuantitySnapshotCron()
startInvoiceAiUsageRollCron()
startSubscriptionLifecycleCron()
startBackupCron()

const gracefulShutdown = async () => {
	logger.info('Shutting down server...')
	clearInterval(cacheMetricsInterval)
	await redisCache.disconnect()
	await closeDb()
	process.exit(0)
}

process.on('SIGINT', gracefulShutdown) // For Ctrl+C shutdown
process.on('SIGTERM', gracefulShutdown) // For termination signal (e.g., from a process manager)

app.listen(config.port, () =>
	logger.info(`Server running on port ${config.port}`),
)
