export const availableQuantityFromStock = (
	quantity: number,
	reservedQuantity = 0,
): number => Math.max(0, quantity - reservedQuantity)
