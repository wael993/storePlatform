import { lt } from 'drizzle-orm'
import cron from 'node-cron'
import { getDb } from '../db'
import { productImportSessions, refreshTokens } from '../db/schema'
import logger from '../shared/logger/logger'

export function startTokenCleanupCron(): void {
	// Run every hour
	cron.schedule('0 * * * *', async () => {
		try {
			// replaces Mongo's TTL index on expiresAt
			const deleted = await getDb()
				.delete(refreshTokens)
				.where(lt(refreshTokens.expiresAt, new Date()))
				.returning({ id: refreshTokens.id })

			if (deleted.length > 0) {
				logger.info(`Cron: cleaned ${deleted.length} expired refresh tokens`)
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
