export const parseTransferQty = (quantityText: string): number =>
	Number.parseInt(quantityText, 10)

export const isTransferQtyValid = (
	quantity: number,
	available: number,
): boolean =>
	Number.isInteger(quantity) && quantity >= 1 && quantity <= available
