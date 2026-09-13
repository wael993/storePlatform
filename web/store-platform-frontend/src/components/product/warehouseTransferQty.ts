export const parseTransferQty = (quantityText: string): number =>
	Number.parseInt(quantityText, 10)

export const isTransferQtyValid = (
	quantity: number,
	sourceQty: number,
): boolean =>
	Number.isInteger(quantity) && quantity >= 1 && quantity <= sourceQty
