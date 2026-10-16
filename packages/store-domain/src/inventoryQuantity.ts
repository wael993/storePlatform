export const availableQuantityFromStock = (
	quantity: number,
	reservedQuantity = 0,
): number => Math.max(0, quantity - reservedQuantity)

/** At or under a set minimum. Missing quantity is 0. A missing or 0 minimum does not alert. */
export const isLowStock = (
	quantity: number | null | undefined,
	minQuantity: number | null | undefined,
): boolean =>
	typeof minQuantity === 'number' &&
	minQuantity > 0 &&
	(typeof quantity === 'number' ? quantity : 0) <= minQuantity

export type OversellLine = {
	productId: string
	name: string
	requested: number
	available: number
}

/** Missing map entries are unknown stock, not zero. Callers that mean 0 must set it. */
export const findOversellLines = (
	items: Array<{ productId: string; name: string; quantity: number }>,
	availableByProductId: ReadonlyMap<string, number>,
	allowOversell: boolean,
): OversellLine[] => {
	if (allowOversell) return []

	const lines: OversellLine[] = []

	for (const item of items) {
		const available = availableByProductId.get(item.productId)

		if (available === undefined || available >= item.quantity) continue

		lines.push({
			productId: item.productId,
			name: item.name,
			requested: item.quantity,
			available,
		})
	}

	return lines
}
