import { lt } from 'drizzle-orm'
import cron from 'node-cron'
import RefreshToken from '../models/RefreshToken'
import { getDb } from '../db'
import { productImportSessions } from '../db/schema'
import logger from '../shared/logger/logger'

export function startTokenCleanupCron(): void {
	// Run every hour
	cron.schedule('0 * * * *', async () => {
		try {
			const result = await RefreshToken.deleteMany({
				expiresAt: { $lt: new Date() },
			})

			if (result.deletedCount > 0) {
				logger.info(
					`Cron: cleaned ${result.deletedCount} expired refresh tokens`,
				)
			}
		} catch (error) {
			logger.error('Cron: failed to clean expired refresh tokens', error)
		}

		try {
			// Replaces Mongo's TTL index on expiresAt. Maintenance across all
			// tenants on purpose: it only deletes expired drafts by date.
			const deleted = await getDb()
				.delete(productImportSessions)
				.where(lt(productImportSessions.expiresAt, new Date()))
				.returning({ id: productImportSessions.id })

			if (deleted.length > 0) {
				logger.info(`Cron: cleaned ${deleted.length} expired import drafts`)
			}
		} catch (error) {
			logger.error('Cron: failed to clean expired import drafts', error)
		}
	})

	logger.info(
		'Cron: expired refresh token + import draft cleanup scheduled (every hour)',
	)
}
