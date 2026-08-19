import { NegativeQuantitySnapshot } from '../../models/NegativeQuantitySnapshot'
import { NotificationRead } from '../../models/NotificationRead'
import { getTenantContext } from '../../shared/tenant'
import { RequestContext } from '../../shared/types'

export const NEGATIVE_QUANTITY_DIGEST = 'NEGATIVE_QUANTITY_DIGEST'

export type ProductNotification = {
	type: typeof NEGATIVE_QUANTITY_DIGEST
	runAt: string
	count: number
}

export type ProductNotificationsResponse = {
	items: ProductNotification[]
}

export default class NotificationController {
	public async getProductNotifications(
		requestContext: RequestContext,
	): Promise<ProductNotificationsResponse> {
		const { tenantId } = getTenantContext(requestContext)
		const snapshot = await NegativeQuantitySnapshot.findOne({ tenantId })
			.select({ runAt: 1, count: 1, _id: 0 })
			.lean()

		if (!snapshot) {
			return { items: [] }
		}

		const userId = requestContext.userId

		if (userId) {
			const read = await NotificationRead.findOne({
				tenantId,
				userId,
				runAt: snapshot.runAt,
			})
				.select({ _id: 1 })
				.lean()

			if (read) {
				return { items: [] }
			}
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
}
