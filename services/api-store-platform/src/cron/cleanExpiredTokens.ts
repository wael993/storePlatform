import cron from 'node-cron'
import RefreshToken from '../models/RefreshToken'
import logger from '../shared/logger/logger'

export function startTokenCleanupCron(): void {
	// Run every hour
	cron.schedule('0 * * * *', async () => {
		try {
			const result = await RefreshToken.deleteMany({
				expiresAt: { $lt: new Date() },
			})
			if (result.deletedCount > 0) {
				logger.info(`Cron: cleaned ${result.deletedCount} expired refresh tokens`)
			}
		} catch (error) {
			logger.error('Cron: failed to clean expired refresh tokens', error)
		}
	})

	logger.info('Cron: expired refresh token cleanup scheduled (every hour)')
}
