import cron from 'node-cron'
import Tenant from '../models/Tenant'
import { config } from '../config/config'
import { TENANT_STATUS } from '../shared/constants/tenant.constants'
import { TENANT_ACCESSIBLE_PAGE } from '../shared/constants/tenantAccessiblePages'
import { persistRolledInvoiceAiUsage } from '../shared/invoiceAi/usage'
import logger from '../shared/logger/logger'

const runInvoiceAiUsageRoll = async (): Promise<void> => {
	const tenants = await Tenant.find({
		status: TENANT_STATUS.ACTIVE,
		accessiblePages: TENANT_ACCESSIBLE_PAGE.INVOICE_AI,
		'invoiceAi.activatedAt': { $exists: true },
	})
		.select({ tenantId: 1, _id: 0 })
		.lean()

	logger.info(
		`Cron: Invoice AI usage roll starting (${tenants.length} tenant(s))`,
	)

	for (const tenant of tenants) {
		try {
			await persistRolledInvoiceAiUsage(tenant.tenantId)
		} catch (error) {
			logger.error(
				`Cron: Invoice AI usage roll failed for tenant ${tenant.tenantId}: ${error}`,
			)
		}
	}
}

export function startInvoiceAiUsageRollCron(): void {
	const { dailySchedule, timezone } = config.cron

	cron.schedule(
		dailySchedule,
		async () => {
			try {
				await runInvoiceAiUsageRoll()
			} catch (error) {
				logger.error(`Cron: Invoice AI usage roll failed: ${error}`)
			}
		},
		{
			timezone,
			// note: node-cron cannot kill an in-flight run (K8s Replace). Skip overlap; upgrade to a leader lock if replicas double-fire.
			noOverlap: true,
			name: 'invoice-ai-usage-roll',
		},
	)

	logger.info(
		`Cron: Invoice AI usage roll scheduled (${dailySchedule} ${timezone})`,
	)
}
