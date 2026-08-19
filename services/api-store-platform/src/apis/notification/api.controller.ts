import { NegativeQuantitySnapshot } from '../../models/NegativeQuantitySnapshot'
import { NotificationRead } from '../../models/NotificationRead'
import { Product } from '../../models/Products'
import { Inventory } from '../../models/Inventory'
import ProductsMapper from '../mappings/ProductsMapper'
import {
	AuthorizationError,
	BusinessLogicError,
} from '../../middleware/errorHandler'
import { ERROR_CODES } from '../../shared/errorCodes'
import {
	getFrontendResourcesForRole,
	getTenantContext,
} from '../../shared/tenant'
import {
	InventoryDocument,
	ProductAPI,
	ProductRequestBody,
	RequestContext,
} from '../../shared/types'

export const NEGATIVE_QUANTITY_DIGEST = 'NEGATIVE_QUANTITY_DIGEST'
export const SEE_NOTIFICATIONS = 'seeNotifications'

const PRODUCTS_FRONTEND_PATH = '/services/store_platform/products'

export type ProductNotification = {
	type: typeof NEGATIVE_QUANTITY_DIGEST
	runAt: string
	count: number
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

const assertCanSeeNotifications = async (
	requestContext: RequestContext,
): Promise<string> => {
	if (!requestContext.userId) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Missing seeNotifications permission.',
		)
	}

	const { role } = getTenantContext(requestContext)
	const frontendResources = await getFrontendResourcesForRole(role)
	const allowedActions =
		frontendResources?.[PRODUCTS_FRONTEND_PATH]?.allowedActions ?? []

	if (!allowedActions.includes(SEE_NOTIFICATIONS)) {
		throw new AuthorizationError(
			ERROR_CODES.AUTHORIZATION.FORBIDDEN,
			'Missing seeNotifications permission.',
		)
	}

	return requestContext.userId
}

export default class NotificationController {
	public async getProductNotifications(
		requestContext: RequestContext,
	): Promise<ProductNotificationsResponse> {
		await assertCanSeeNotifications(requestContext)

		const { tenantId } = getTenantContext(requestContext)
		const snapshot = await NegativeQuantitySnapshot.findOne({ tenantId })
			.select({ runAt: 1, count: 1, _id: 0 })
			.lean()

		if (!snapshot) {
			return { items: [] }
		}

		const read = await NotificationRead.findOne({
			tenantId,
			userId: requestContext.userId,
			runAt: snapshot.runAt,
		})
			.select({ _id: 1 })
			.lean()

		if (read) {
			return { items: [] }
		}

		return {
			items: [
				{
					type: NEGATIVE_QUANTITY_DIGEST,
					runAt: snapshot.runAt.toISOString(),
					count: snapshot.count,
				},
			],
		}
	}

	public async getProductNotificationDigest(
		requestContext: RequestContext,
	): Promise<ProductNotificationDigestResponse> {
		await assertCanSeeNotifications(requestContext)

		const { tenantId } = getTenantContext(requestContext)
		const snapshot = await NegativeQuantitySnapshot.findOne({ tenantId })
			.select({ runAt: 1, productIds: 1, _id: 0 })
			.lean()

		if (!snapshot) {
			return { runAt: null, products: [] }
		}

		const [products, inventory] = await Promise.all([
			Product.find({
				tenantId,
				productId: { $in: snapshot.productIds },
			}).lean<ProductAPI[]>(),
			Inventory.find({
				tenantId,
				productId: { $in: snapshot.productIds },
			}).lean<InventoryDocument[]>(),
		])

		const productById = new Map(
			products.map(product => [product.productId, product]),
		)
		const inventoryByProductId = new Map(
			inventory.map(item => [item.productId, item]),
		)

		return {
			runAt: snapshot.runAt.toISOString(),
			products: snapshot.productIds.flatMap(productId => {
				const product = productById.get(productId)

				if (!product) {
					return []
				}

				return [
					productsMapper.mapProduct(
						product,
						inventoryByProductId.get(productId),
						requestContext,
					),
				]
			}),
		}
	}

	public async markProductNotificationsRead(
		requestContext: RequestContext,
		body: MarkProductNotificationsReadBody,
	): Promise<void> {
		const userId = await assertCanSeeNotifications(requestContext)
		const markAll = body?.all === true
		const markDigest = body?.type === NEGATIVE_QUANTITY_DIGEST

		if (!markAll && !markDigest) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
				'Invalid mark-read body.',
			)
		}

		const { tenantId } = getTenantContext(requestContext)
		const snapshot = await NegativeQuantitySnapshot.findOne({ tenantId })
			.select({ runAt: 1, _id: 0 })
			.lean()

		if (!snapshot) {
			return
		}

		try {
			await NotificationRead.updateOne(
				{ tenantId, userId, runAt: snapshot.runAt },
				{ $setOnInsert: { tenantId, userId, runAt: snapshot.runAt } },
				{ upsert: true },
			)
		} catch (error: unknown) {
			const duplicateKey =
				typeof error === 'object' &&
				error !== null &&
				'code' in error &&
				error.code === 11000

			if (!duplicateKey) {
				throw error
			}
		}
	}
}
