import cron from 'node-cron'
import Tenant, { ITenant } from '../models/Tenant'
import { config } from '../config/config'
import { syncTenantSubscription } from '../shared/subscription/persist'
import logger from '../shared/logger/logger'

export const runSubscriptionLifecycle = async (
	now = new Date(),
): Promise<void> => {
	const tenants = await Tenant.find().lean<ITenant[]>()

	logger.info(
		`Cron: subscription lifecycle starting (${tenants.length} tenant(s))`,
	)

	for (const tenant of tenants) {
		try {
			await syncTenantSubscription(tenant, now)
		} catch (error) {
			logger.error(
				`Cron: subscription lifecycle failed for tenant ${tenant.tenantId}: ${error}`,
			)
		}
	}
}

export function startSubscriptionLifecycleCron(): void {
	const { dailySchedule, timezone } = config.cron

	cron.schedule(
		dailySchedule,
		async () => {
			try {
				await runSubscriptionLifecycle()
			} catch (error) {
				logger.error(`Cron: subscription lifecycle failed: ${error}`)
			}
		},
		{
			timezone,
			// note: node-cron cannot kill an in-flight run (K8s Replace). Skip overlap; upgrade to a leader lock if replicas double-fire.
			noOverlap: true,
			name: 'subscription-lifecycle',
		},
	)

	logger.info(
		`Cron: subscription lifecycle scheduled (${dailySchedule} ${timezone})`,
	)
}
