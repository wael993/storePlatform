import cron from 'node-cron'
import mongoose from 'mongoose'
import { config } from '../config/config'
import { Inventory } from '../models/Inventory'
import {
	MISSING_PURCHASE_PRICE_DIGEST,
	MISSING_RETAIL_PRICE_DIGEST,
	NEGATIVE_QUANTITY_DIGEST,
	NegativeQuantitySnapshot,
	ProductDigestType,
	RETAIL_BELOW_PURCHASE_DIGEST,
} from '../models/NegativeQuantitySnapshot'
import { NotificationRead } from '../models/NotificationRead'
import { Product } from '../models/Products'
import Tenant from '../models/Tenant'
import { TENANT_STATUS } from '../shared/constants/tenant.constants'
import logger from '../shared/logger/logger'

const CRON_ACTOR = {
	_id: 'cron',
	displayName: 'Cron',
}

const INDEX_NOT_FOUND = 27

const dropIndexIfExists = async (
	collection: mongoose.Collection,
	name: string,
) => {
	try {
		await collection.dropIndex(name)
	} catch (error: unknown) {
		const code =
			typeof error === 'object' && error !== null && 'code' in error
				? error.code
				: undefined

		if (code !== INDEX_NOT_FOUND) {
			throw error
		}
	}
}

let digestIndexesReady: Promise<void> | null = null

export const ensureProductDigestIndexes = (): Promise<void> => {
	if (!digestIndexesReady) {
		digestIndexesReady = (async () => {
			await mongoose.connection.asPromise()

			const snapshotIndexes =
				await NegativeQuantitySnapshot.collection.indexes()

			for (const index of snapshotIndexes) {
				const key = index.key as Record<string, number>

				if (
					index.unique &&
					index.name &&
					Object.keys(key).length === 1 &&
					key.tenantId === 1
				) {
					await dropIndexIfExists(
						NegativeQuantitySnapshot.collection,
						index.name,
					)
				}
			}

			const readIndexes = await NotificationRead.collection.indexes()

			for (const index of readIndexes) {
				const key = index.key as Record<string, number>

				if (
					index.unique &&
					index.name &&
					key.tenantId === 1 &&
					key.userId === 1 &&
					key.runAt === 1 &&
					key.type === undefined
				) {
					await dropIndexIfExists(NotificationRead.collection, index.name)
				}
			}

			await NegativeQuantitySnapshot.syncIndexes()
			await NotificationRead.syncIndexes()
		})().catch(error => {
			digestIndexesReady = null

			throw error
		})
	}

	return digestIndexesReady
}

const uniqueProductIds = (ids: Array<string | undefined>): string[] =>
	[...new Set(ids.filter((id): id is string => Boolean(id)))].sort()

const persistDigestSnapshot = async (
	tenantId: string,
	runAt: Date,
	type: ProductDigestType,
	productIds: string[],
) => {
	if (productIds.length === 0) {
		await NegativeQuantitySnapshot.deleteMany({
			tenantId,
			...(type === NEGATIVE_QUANTITY_DIGEST
				? { $or: [{ type }, { type: { $exists: false } }] }
				: { type }),
		})

		return { tenantId, type, count: 0, productIds: [] }
	}

	if (type === NEGATIVE_QUANTITY_DIGEST) {
		await NegativeQuantitySnapshot.updateMany(
			{ tenantId, type: { $exists: false } },
			{ $set: { type: NEGATIVE_QUANTITY_DIGEST } },
		)
	}

	await NegativeQuantitySnapshot.findOneAndUpdate(
		{ tenantId, type },
		{
			$set: {
				type,
				runAt,
				productIds,
				count: productIds.length,
			},
			$setOnInsert: {
				tenantId,
				createdBy: { ...CRON_ACTOR, createdAt: runAt },
			},
		},
		{ upsert: true },
	)

	return { tenantId, type, count: productIds.length, productIds }
}

const persistProductDigestSnapshot = async (
	tenantId: string,
	runAt: Date,
	type: ProductDigestType,
	filter: Record<string, unknown>,
) => {
	const rows = await Product.find({ tenantId, ...filter })
		.select({ productId: 1, _id: 0 })
		.lean<Array<{ productId?: string }>>()

	return persistDigestSnapshot(
		tenantId,
		runAt,
		type,
		uniqueProductIds(rows.map(row => row.productId)),
	)
}

const persistNegativeQuantitySnapshot = async (
	tenantId: string,
	runAt: Date,
) => {
	const rows = await Inventory.find({ tenantId, quantity: { $lt: 0 } })
		.select({ productId: 1, _id: 0 })
		.lean<Array<{ productId?: string }>>()

	return persistDigestSnapshot(
		tenantId,
		runAt,
		NEGATIVE_QUANTITY_DIGEST,
		uniqueProductIds(rows.map(row => row.productId)),
	)
}

const persistTenantDigests = async (tenantId: string, runAt: Date) => {
	for (const persist of [
		persistNegativeQuantitySnapshot,
		(id: string, at: Date) =>
			persistProductDigestSnapshot(id, at, MISSING_PURCHASE_PRICE_DIGEST, {
				$nor: [{ 'price.purchasePrice': { $gt: 0 } }],
			}),
		(id: string, at: Date) =>
			persistProductDigestSnapshot(id, at, MISSING_RETAIL_PRICE_DIGEST, {
				$nor: [{ 'price.retailPrice': { $gt: 0 } }],
			}),
		(id: string, at: Date) =>
			persistProductDigestSnapshot(id, at, RETAIL_BELOW_PURCHASE_DIGEST, {
				'price.purchasePrice': { $gt: 0 },
				'price.retailPrice': { $gt: 0 },
				$expr: { $lt: ['$price.retailPrice', '$price.purchasePrice'] },
			}),
	]) {
		try {
			logSnapshotResult(await persist(tenantId, runAt))
		} catch (error) {
			logger.error(
				`Cron: product digest snapshot failed for tenant ${tenantId}: ${error}`,
			)
		}
	}
}

const logSnapshotResult = (result: {
	tenantId: string
	type: ProductDigestType
	count: number
	productIds: string[]
}) => {
	logger.info(
		result.count === 0
			? `Cron: ${result.type} snapshot tenant=${result.tenantId} cleared`
			: `Cron: ${result.type} snapshot tenant=${result.tenantId} count=${result.count} productIds=${result.productIds.join(',')}`,
	)
}

export const runNegativeQuantitySnapshot = async (
	runAt = new Date(),
): Promise<void> => {
	await ensureProductDigestIndexes()

	const tenants = await Tenant.find({ status: TENANT_STATUS.ACTIVE })
		.select({ tenantId: 1, _id: 0 })
		.lean()

	logger.info(
		`Cron: product digest snapshots starting (${tenants.length} active tenant(s))`,
	)

	for (const tenant of tenants) {
		await persistTenantDigests(tenant.tenantId, runAt)
	}
}

export function startNegativeQuantitySnapshotCron(): void {
	const { dailySchedule, timezone } = config.cron

	void ensureProductDigestIndexes().catch(error => {
		logger.error(`Cron: product digest index sync failed: ${error}`)
	})

	cron.schedule(
		dailySchedule,
		async () => {
			try {
				await runNegativeQuantitySnapshot()
			} catch (error) {
				logger.error(`Cron: product digest snapshot failed: ${error}`)
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
		`Cron: product digest snapshots scheduled (${dailySchedule} ${timezone})`,
	)
}
