/** Stock moving types that make Inventory.averageCost established WAC. */
export const ESTABLISHED_COST_MOVING_TYPES = [
	'purchase',
	'transfer_in',
] as const

export const isEstablishedCostMovingType = (type: unknown): boolean =>
	type === 'purchase' || type === 'transfer_in'

export const finiteCost = (value: unknown): number | undefined => {
	if (value == null) return undefined
	if (typeof value === 'string' && value.trim() === '') return undefined

	const cost = Number(value)

	return Number.isFinite(cost) ? cost : undefined
}

export const openingAverageCostFromPurchasePrice = finiteCost

/** Qty-weighted WAC. Missing/invalid costs are skipped, never treated as 0. */
export const mergeQtyWeightedAverageCost = (
	existingCost: unknown,
	existingQty: number,
	nextCost: unknown,
	nextQty: number,
): number | undefined => {
	const existing = finiteCost(existingCost)
	const next = finiteCost(nextCost)

	if (existing != null && next != null) {
		const totalQty = existingQty + nextQty

		if (totalQty <= 0) return existing

		return (existing * existingQty + next * nextQty) / totalQty
	}

	if (next != null) return next

	if (existing != null) return existing

	return undefined
}

export type InventoryScopeRow = {
	productId?: string
	inventoryId?: string
	warehouseId?: string
	shelfId?: string
	_id?: unknown
	quantity?: number
	availableQuantity?: number
	reservedQuantity?: number
	averageCost?: number
}

/**
 * Sum qty across warehouse rows; qty-weighted averageCost.
 * One row keeps identity. Two or more blank inventoryId / warehouseId / shelfId / `_id`
 * so combined view cannot PATCH a single warehouse's row.
 */
export const aggregateInventoryByProductId = <T extends InventoryScopeRow>(
	items: T[],
): Map<string, T> => {
	const byProductId = new Map<string, T>()
	const costQtyByProductId = new Map<string, number>()

	for (const item of items) {
		if (!item.productId) continue

		const existing = byProductId.get(item.productId)
		const nextQty = Number(item.quantity ?? 0)
		const nextCost = finiteCost(item.averageCost)

		if (!existing) {
			byProductId.set(item.productId, item)
			costQtyByProductId.set(item.productId, nextCost != null ? nextQty : 0)
			continue
		}

		const existingQty = Number(existing.quantity ?? 0)
		const existingCostQty = costQtyByProductId.get(item.productId) ?? 0
		const totalQty = existingQty + nextQty

		byProductId.set(item.productId, {
			...existing,
			inventoryId: '',
			warehouseId: '',
			shelfId: undefined,
			_id: undefined,
			quantity: totalQty,
			availableQuantity:
				Number(existing.availableQuantity ?? 0) +
				Number(item.availableQuantity ?? 0),
			reservedQuantity:
				Number(existing.reservedQuantity ?? 0) +
				Number(item.reservedQuantity ?? 0),
			averageCost: mergeQtyWeightedAverageCost(
				existing.averageCost,
				existingCostQty,
				nextCost,
				nextQty,
			),
		})

		costQtyByProductId.set(
			item.productId,
			existingCostQty + (nextCost != null ? nextQty : 0),
		)
	}

	return byProductId
}

export const establishedWarehouseIdsFromMovings = (
	movings: Array<{
		type?: unknown
		warehouseId?: unknown
		referenceId?: unknown
		referenceType?: unknown
	}>,
): Set<string> => {
	const cancelledPurchaseRefs = new Set(
		movings
			.filter(
				moving =>
					moving.type === 'return_out' &&
					(moving.referenceType == null ||
						moving.referenceType === 'buying_invoice'),
			)
			.map(moving => String(moving.referenceId ?? ''))
			.filter(Boolean),
	)
	const warehouseIds = new Set<string>()

	for (const moving of movings) {
		if (moving.type === 'purchase') {
			if (cancelledPurchaseRefs.has(String(moving.referenceId ?? ''))) continue
		} else if (moving.type !== 'transfer_in') {
			continue
		}

		const warehouseId = String(moving.warehouseId ?? '')

		if (warehouseId) warehouseIds.add(warehouseId)
	}

	return warehouseIds
}

export const shouldReplaceOpeningAverageCost = (
	warehouseId: string,
	establishedWarehouseIds: ReadonlySet<string>,
): boolean => Boolean(warehouseId) && !establishedWarehouseIds.has(warehouseId)
