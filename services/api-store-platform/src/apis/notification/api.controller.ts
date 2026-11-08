import { isUniqueViolation } from '../../db'
import { pgFind, pgFindOne, pgFindOneAndUpdate } from '../../db/mongoQuery'
import {
	LOW_STOCK_DIGEST,
	MISSING_PURCHASE_PRICE_DIGEST,
	MISSING_RETAIL_PRICE_DIGEST,
	NEGATIVE_QUANTITY_DIGEST,
	NegativeQuantitySnapshot,
	ProductDigestType,
	RETAIL_BELOW_PURCHASE_DIGEST,
	isProductDigestType,
} from '../../models/NegativeQuantitySnapshot'
import { NotificationRead } from '../../models/NotificationRead'
import { Product } from '../../models/Products'
import { Inventory } from '../../models/Inventory'
import { Warehouse } from '../../models/Warehaus'
import { findLowStockRows } from '../../cron/snapshotNegativeQuantity'
import { getAllowedWarehouseIds } from '../../shared/warehouseAccess'
import ProductsMapper from '../mappings/ProductsMapper'
import { SEE, SeeId, stripProductSeeFields } from '../../shared/seeCatalog'
import {
	AuthorizationError,
	BusinessLogicError,
} from '../../middleware/errorHandler'
import { ERROR_CODES } from '../../shared/errorCodes'
import { getTenantContext } from '../../shared/tenant'
import { ensureSeeIds } from '../../shared/seePermissions'
import {
	InventoryDocument,
	ProductAPI,
	ProductRequestBody,
	RequestContext,
} from '../../shared/types'

export {
	LOW_STOCK_DIGEST,
	MISSING_PURCHASE_PRICE_DIGEST,
	MISSING_RETAIL_PRICE_DIGEST,
	NEGATIVE_QUANTITY_DIGEST,
	RETAIL_BELOW_PURCHASE_DIGEST,
	isProductDigestType,
}
export type { ProductDigestType }

export type ProductNotification = {
	type: ProductDigestType
	runAt: string
	count: number
	/** Snapshot product ids for LOW_STOCK_DIGEST so offline can recount. */
	productIds?: string[]
}

export type ProductNotificationsResponse = {
	items: ProductNotification[]
}

export type ProductNotificationDigestResponse = {
	runAt: string | null
	products: ProductRequestBody[]
}

export type MarkProductNotificationsReadBody = {
	all?: boolean
	type?: string
}

const productsMapper = new ProductsMapper()

const digestTypeOf = (type?: string): ProductDigestType =>
	isProductDigestType(type) ? type : NEGATIVE_QUANTITY_DIGEST

const upsertRead = async (
	tenantId: string,
	userId: string,
	runAt: Date,
	type: ProductDigestType,
) => {
	try {
		await pgFindOneAndUpdate(
			NotificationRead,
			tenantId,
			{ userId, runAt, type },
			{ $setOnInsert: { tenantId, userId, runAt, type } },
			{ upsert: true },
		)
	} catch (error: unknown) {
		// a parallel request recorded the same read first
		if (!isUniqueViolation(error)) throw error
	}
}

const assertCanSeeNotifications = async (
	requestContext: RequestContext,
): Promise<string> => {
	if (!requestContext.userId) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Missing seeNotifications permission.',
		)
	}

	await ensureSeeIds(requestContext, [SEE.productsNotifications])

	return requestContext.userId
}

const hydrateDigestProducts = async (
	tenantId: string,
	productIds: string[],
	requestContext: RequestContext,
): Promise<ProductRequestBody[]> => {
	const [products, inventory] = await Promise.all([
		pgFind(Product, tenantId, {
			tenantId,
			productId: { $in: productIds },
		}) as unknown as Promise<ProductAPI[]>,
		pgFind(Inventory, tenantId, {
			productId: { $in: productIds },
		}) as unknown as Promise<InventoryDocument[]>,
	])

	const productById = new Map(
		products.map(product => [product.productId, product]),
	)
	const inventoryByProductId = new Map(
		inventory.map(item => [item.productId, item]),
	)

	return productIds.flatMap(productId => {
		const product = productById.get(productId)

		if (!product) {
			return []
		}

		return [
			stripProductSeeFields(
				productsMapper.mapProduct(product, inventoryByProductId.get(productId)),
				new Set((requestContext.see || []) as SeeId[]),
			),
		]
	})
}

const lowStockDigestProducts = async (
	tenantId: string,
	productIds: string[],
	requestContext: RequestContext,
): Promise<ProductRequestBody[]> => {
	const rows = await findLowStockRows(
		tenantId,
		getAllowedWarehouseIds(requestContext),
		productIds,
	)

	if (rows.length === 0) {
		return []
	}

	const matchedProductIds = [...new Set(rows.map(row => row.productId))]
	const warehouseIds = [...new Set(rows.map(row => row.warehouseId))]
	const [products, warehouses] = await Promise.all([
		pgFind(Product, tenantId, {
			tenantId,
			status: 'active',
			productId: { $in: matchedProductIds },
		}) as unknown as Promise<ProductAPI[]>,
		pgFind(
			Warehouse,
			tenantId,
			{ tenantId, warehouseId: { $in: warehouseIds } },
			{ select: { warehouseId: 1, name: 1, _id: 0 } },
		) as unknown as Promise<Array<{ warehouseId: string; name?: string }>>,
	])
	const productById = new Map(
		products.map(product => [product.productId, product]),
	)
	const nameById = new Map(
		warehouses.map(warehouse => [
			warehouse.warehouseId,
			warehouse.name?.trim() || warehouse.warehouseId,
		]),
	)
	const grouped = new Map<
		string,
		NonNullable<ProductRequestBody['lowStockWarehouses']>
	>()

	for (const row of rows) {
		const list = grouped.get(row.productId) ?? []

		list.push({
			warehouseId: row.warehouseId,
			warehouseName: nameById.get(row.warehouseId) || row.warehouseId,
			quantity: row.quantity,
			minQuantity: row.minQuantity,
		})

		grouped.set(row.productId, list)
	}

	for (const list of grouped.values()) {
		list.sort((left, right) =>
			left.warehouseName.localeCompare(right.warehouseName),
		)
	}

	const see = new Set((requestContext.see || []) as SeeId[])

	return productIds.flatMap(productId => {
		const product = productById.get(productId)
		const lowStockWarehouses = grouped.get(productId)

		if (!product || !lowStockWarehouses?.length) {
			return []
		}

		return [
			{
				...stripProductSeeFields(
					productsMapper.mapProduct(product, undefined),
					see,
				),
				lowStockWarehouses,
			},
		]
	})
}

export default class NotificationController {
	public async getProductNotifications(
		requestContext: RequestContext,
		options: { includeRead?: boolean } = {},
	): Promise<ProductNotificationsResponse> {
		const userId = await assertCanSeeNotifications(requestContext)
		const { tenantId } = getTenantContext(requestContext)
		const includeRead = options.includeRead === true
		const snapshots = await pgFind(
			NegativeQuantitySnapshot,
			tenantId,
			{ tenantId },
			{ select: { type: 1, runAt: 1, count: 1, productIds: 1, _id: 0 } },
		)

		if (snapshots.length === 0) {
			return { items: [] }
		}

		const readKeys = includeRead
			? new Set<string>()
			: new Set(
					(
						await pgFind(
							NotificationRead,
							tenantId,
							{
								userId,
								runAt: { $in: snapshots.map(snapshot => snapshot.runAt) },
							},
							{ select: { runAt: 1, type: 1, _id: 0 } },
						)
					).map(read => `${digestTypeOf(read.type)}:${read.runAt.getTime()}`),
				)

		const items: ProductNotification[] = []

		for (const snapshot of snapshots) {
			const type = digestTypeOf(snapshot.type)

			if (readKeys.has(`${type}:${snapshot.runAt.getTime()}`)) {
				continue
			}

			if (type === LOW_STOCK_DIGEST) {
				const rows = await findLowStockRows(
					tenantId,
					getAllowedWarehouseIds(requestContext),
					snapshot.productIds,
				)
				const count = new Set(rows.map(row => row.productId)).size

				if (count === 0 && !includeRead) {
					continue
				}

				items.push({
					type,
					runAt: snapshot.runAt.toISOString(),
					count,
					productIds: snapshot.productIds,
				})

				continue
			}

			items.push({
				type,
				runAt: snapshot.runAt.toISOString(),
				count: snapshot.count,
			})
		}

		return { items }
	}

	public async getProductNotificationDigest(
		requestContext: RequestContext,
		type: string | undefined,
	): Promise<ProductNotificationDigestResponse> {
		await assertCanSeeNotifications(requestContext)

		const digestType = type ?? NEGATIVE_QUANTITY_DIGEST

		if (!isProductDigestType(digestType)) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
				'Invalid digest type.',
			)
		}

		const { tenantId } = getTenantContext(requestContext)
		const snapshot =
			(await pgFindOne(
				NegativeQuantitySnapshot,
				tenantId,
				{
					tenantId,
					type: digestType,
				},
				{ select: { runAt: 1, productIds: 1, _id: 0 } },
			)) ||
			(digestType === NEGATIVE_QUANTITY_DIGEST
				? await pgFindOne(
						NegativeQuantitySnapshot,
						tenantId,
						{
							tenantId,
							type: { $exists: false },
						},
						{ select: { runAt: 1, productIds: 1, _id: 0 } },
					)
				: null)

		if (!snapshot) {
			return { runAt: null, products: [] }
		}

		if (digestType === LOW_STOCK_DIGEST) {
			return {
				runAt: snapshot.runAt.toISOString(),
				products: await lowStockDigestProducts(
					tenantId,
					snapshot.productIds,
					requestContext,
				),
			}
		}

		return {
			runAt: snapshot.runAt.toISOString(),
			products: await hydrateDigestProducts(
				tenantId,
				snapshot.productIds,
				requestContext,
			),
		}
	}

	public async markProductNotificationsRead(
		requestContext: RequestContext,
		body: MarkProductNotificationsReadBody,
	): Promise<void> {
		const userId = await assertCanSeeNotifications(requestContext)
		const markAll = body?.all === true
		const markType = isProductDigestType(body?.type) ? body.type : null

		if (!markAll && !markType) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
				'Invalid mark-read body.',
			)
		}

		const { tenantId } = getTenantContext(requestContext)
		const snapshots = await pgFind(
			NegativeQuantitySnapshot,
			tenantId,
			{
				tenantId,
				...(markAll
					? {}
					: markType === NEGATIVE_QUANTITY_DIGEST
						? {
								$or: [{ type: markType }, { type: { $exists: false } }],
							}
						: { type: markType }),
			},
			{ select: { type: 1, runAt: 1, _id: 0 } },
		)

		for (const snapshot of snapshots) {
			await upsertRead(
				tenantId,
				userId,
				snapshot.runAt,
				digestTypeOf(snapshot.type),
			)
		}
	}
}
