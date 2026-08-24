import connectDB from './db/db'
import { config } from './config/config'
import { startTokenCleanupCron } from './cron/cleanExpiredTokens'
import { startNegativeQuantitySnapshotCron } from './cron/snapshotNegativeQuantity'
import { startInvoiceAiUsageRollCron } from './cron/rollInvoiceAiUsage'
import { startSubscriptionLifecycleCron } from './cron/manageSubscriptions'
import { redisCache } from './shared/cache/redisCache'
import logger, { EntityType } from './shared/logger/logger'
import { createApp } from './app'

const app = createApp()

connectDB()
if (config.redis.enabled) {
	redisCache.connect().catch(() => undefined)
} else {
	logger.info(
		'Redis cache not enabled (set REDIS_ENABLED=true with REDIS_HOST and REDIS_PASSWORD)',
		{ entity: EntityType.STORAGE },
	)
}

const cacheMetricsInterval = setInterval(() => {
	const stats = redisCache.getStats()

	logger.info(
		`[cache-metrics] ready=${stats.ready} hits=${stats.hits} misses=${stats.misses} sets=${stats.sets} dels=${stats.dels} errors=${stats.errors}`,
		{ entity: EntityType.STORAGE },
	)
}, 60_000)

cacheMetricsInterval.unref()

startTokenCleanupCron()
startNegativeQuantitySnapshotCron()
startInvoiceAiUsageRollCron()
startSubscriptionLifecycleCron()

const gracefulShutdown = async () => {
	logger.info('Shutting down server...')
	clearInterval(cacheMetricsInterval)
	await redisCache.disconnect()
	process.exit(0)
}

process.on('SIGINT', gracefulShutdown) // For Ctrl+C shutdown
process.on('SIGTERM', gracefulShutdown) // For termination signal (e.g., from a process manager)

app.listen(config.port, () =>
	logger.info(`Server running on port ${config.port}`),
)
