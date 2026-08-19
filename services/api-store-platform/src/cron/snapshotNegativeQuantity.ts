import cron from 'node-cron'
import { config } from '../config/config'
import { Inventory } from '../models/Inventory'
import { NegativeQuantitySnapshot } from '../models/NegativeQuantitySnapshot'
import Tenant from '../models/Tenant'
import { TENANT_STATUS } from '../shared/constants/tenant.constants'
import logger from '../shared/logger/logger'

const CRON_ACTOR = {
	_id: 'cron',
	displayName: 'Cron',
}

type InventoryQuantityRow = {
	productId?: string
	quantity?: number | null
}

const buildNegativeQuantitySnapshot = (
	rows: InventoryQuantityRow[],
	runAt: Date,
): { productIds: string[]; count: number; runAt: Date } | null => {
	const productIds = [
		...new Set(
			rows
				.filter(
					(row): row is { productId: string; quantity: number } =>
						typeof row.productId === 'string' &&
						row.productId.length > 0 &&
						typeof row.quantity === 'number' &&
						row.quantity < 0,
				)
				.map(row => row.productId),
		),
	].sort()

	if (productIds.length === 0) {
		return null
	}

	return { productIds, count: productIds.length, runAt }
}

const persistTenantSnapshot = async (tenantId: string, runAt: Date) => {
	const rows = await Inventory.find({ tenantId, quantity: { $lt: 0 } })
		.select({ productId: 1, quantity: 1, _id: 0 })
		.lean<InventoryQuantityRow[]>()
	const snapshot = buildNegativeQuantitySnapshot(rows, runAt)

	if (!snapshot) {
		await NegativeQuantitySnapshot.deleteMany({ tenantId })

		return { tenantId, count: 0, productIds: [] }
	}

	await NegativeQuantitySnapshot.findOneAndUpdate(
		{ tenantId },
		{
			$set: {
				runAt: snapshot.runAt,
				productIds: snapshot.productIds,
				count: snapshot.count,
			},
			$setOnInsert: {
				tenantId,
				createdBy: { ...CRON_ACTOR, createdAt: runAt },
			},
		},
		{ upsert: true },
	)

	return {
		tenantId,
		count: snapshot.count,
		productIds: snapshot.productIds,
	}
}

export const runNegativeQuantitySnapshot = async (
	runAt = new Date(),
): Promise<void> => {
	const tenants = await Tenant.find({ status: TENANT_STATUS.ACTIVE })
		.select({ tenantId: 1, _id: 0 })
		.lean()

	logger.info(
		`Cron: negative quantity snapshot starting (${tenants.length} active tenant(s))`,
	)

	for (const tenant of tenants) {
		try {
			const result = await persistTenantSnapshot(tenant.tenantId, runAt)

			logger.info(
				result.count === 0
					? `Cron: negative quantity snapshot tenant=${result.tenantId} cleared`
					: `Cron: negative quantity snapshot tenant=${result.tenantId} count=${result.count} productIds=${result.productIds.join(',')}`,
			)
		} catch (error) {
			logger.error(
				`Cron: negative quantity snapshot failed for tenant ${tenant.tenantId}: ${error}`,
			)
		}
	}
}

export function startNegativeQuantitySnapshotCron(): void {
	const { dailySchedule, timezone } = config.cron

	cron.schedule(
		dailySchedule,
		async () => {
			try {
				await runNegativeQuantitySnapshot()
			} catch (error) {
				logger.error(`Cron: negative quantity snapshot failed: ${error}`)
			}
		},
		{
			timezone,
			// note: node-cron cannot kill an in-flight run (K8s Replace). Skip overlap; upgrade to a leader lock if replicas double-fire.
			noOverlap: true,
			name: 'negative-quantity-snapshot',
		},
	)

	logger.info(
		`Cron: negative quantity snapshot scheduled (${dailySchedule} ${timezone})`,
	)
}
