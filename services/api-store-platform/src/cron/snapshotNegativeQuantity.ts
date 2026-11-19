import cron from 'node-cron'
import { ALL_TENANTS } from '../db'
import {
	pgDeleteMany,
	pgFind,
	pgFindOneAndUpdate,
	pgUpdateMany,
} from '../db/mongoQuery'
import { config } from '../config/config'
import { Inventory } from '../models/Inventory'
import {
	LOW_STOCK_DIGEST,
	MISSING_PURCHASE_PRICE_DIGEST,
	MISSING_RETAIL_PRICE_DIGEST,
	NEGATIVE_QUANTITY_DIGEST,
	NegativeQuantitySnapshot,
	ProductDigestType,
	RETAIL_BELOW_PURCHASE_DIGEST,
} from '../models/NegativeQuantitySnapshot'
import { isLowStock } from '../shared/inventoryCost'
import { Product } from '../models/Products'
import Tenant from '../models/Tenant'
import { TENANT_STATUS } from '../shared/constants/tenant.constants'
import logger from '../shared/logger/logger'

const CRON_ACTOR = {
	_id: 'cron',
	displayName: 'Cron',
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
		await pgDeleteMany(NegativeQuantitySnapshot, tenantId, {
			...(type === NEGATIVE_QUANTITY_DIGEST
				? { $or: [{ type }, { type: { $exists: false } }] }
				: { type }),
		})

		return { tenantId, type, count: 0, productIds: [] }
	}

	if (type === NEGATIVE_QUANTITY_DIGEST) {
		await pgUpdateMany(
			NegativeQuantitySnapshot,
			tenantId,
			{ type: { $exists: false } },
			{ $set: { type: NEGATIVE_QUANTITY_DIGEST } },
		)
	}

	await pgFindOneAndUpdate(
		NegativeQuantitySnapshot,
		tenantId,
		{ type },
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
	/** Field-to-field condition (former `$expr`), checked in code. */
	keep?: (product: {
		price?: { retailPrice?: number; purchasePrice?: number }
	}) => boolean,
) => {
	const rows = await pgFind<{
		productId?: string
		price?: { retailPrice?: number; purchasePrice?: number }
	}>(Product, tenantId, filter, {
		select: { productId: 1, price: 1, _id: 0 },
	})

	return persistDigestSnapshot(
		tenantId,
		runAt,
		type,
		uniqueProductIds(
			rows.filter(row => !keep || keep(row)).map(row => row.productId),
		),
	)
}

export type LowStockRow = {
	productId: string
	warehouseId: string
	quantity: number
	minQuantity: number
}

/** Active products only. `warehouseIds` null means every warehouse; [] means none. */
export const findLowStockRows = async (
	tenantId: string,
	warehouseIds: string[] | null,
	onlyProductIds?: string[],
): Promise<LowStockRow[]> => {
	if (warehouseIds?.length === 0 || onlyProductIds?.length === 0) {
		return []
	}

	const products = await (pgFind(
		Product,
		tenantId,
		{
			tenantId,
			status: 'active',
			...(onlyProductIds ? { productId: { $in: onlyProductIds } } : {}),
		},
		{ select: { productId: 1, _id: 0 } },
	) as unknown as Promise<Array<{ productId?: string }>>)

	const activeIds = products
		.map(product => product.productId)
		.filter((id): id is string => Boolean(id))

	if (activeIds.length === 0) {
		return []
	}

	const rows = (await pgFind(
		Inventory,
		tenantId,
		{
			productId: { $in: activeIds },
			minQuantity: { $gt: 0 },
			...(warehouseIds ? { warehouseId: { $in: warehouseIds } } : {}),
		},
		{
			select: {
				productId: 1,
				warehouseId: 1,
				quantity: 1,
				minQuantity: 1,
				_id: 0,
			},
		},
	)) as unknown as Array<{
		productId?: string
		warehouseId?: string
		quantity?: number
		minQuantity?: number
	}>

	return rows.flatMap(row => {
		if (!row.productId || !row.warehouseId) {
			return []
		}

		if (!isLowStock(row.quantity, row.minQuantity)) {
			return []
		}

		return [
			{
				productId: row.productId,
				warehouseId: row.warehouseId,
				quantity: typeof row.quantity === 'number' ? row.quantity : 0,
				minQuantity: row.minQuantity as number,
			},
		]
	})
}

const persistLowStockSnapshot = async (tenantId: string, runAt: Date) => {
	const rows = await findLowStockRows(tenantId, null)

	return persistDigestSnapshot(
		tenantId,
		runAt,
		LOW_STOCK_DIGEST,
		uniqueProductIds(rows.map(row => row.productId)),
	)
}

const persistNegativeQuantitySnapshot = async (
	tenantId: string,
	runAt: Date,
) => {
	const rows = (await pgFind(
		Inventory,
		tenantId,
		{ quantity: { $lt: 0 } },
		{ select: { productId: 1, _id: 0 } },
	)) as Array<{ productId?: string }>

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
			persistProductDigestSnapshot(
				id,
				at,
				RETAIL_BELOW_PURCHASE_DIGEST,
				{ 'price.purchasePrice': { $gt: 0 }, 'price.retailPrice': { $gt: 0 } },
				product =>
					Number(product.price?.retailPrice) <
					Number(product.price?.purchasePrice),
			),
		persistLowStockSnapshot,
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
	const tenants = await pgFind<{ tenantId: string }>(
		Tenant,
		ALL_TENANTS,
		{ status: TENANT_STATUS.ACTIVE },
		{ select: { tenantId: 1, _id: 0 } },
	)

	logger.info(
		`Cron: product digest snapshots starting (${tenants.length} active tenant(s))`,
	)

	for (const tenant of tenants) {
		await persistTenantDigests(tenant.tenantId, runAt)
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
