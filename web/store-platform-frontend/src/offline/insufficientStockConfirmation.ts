export interface InsufficientStockItem {
	productId: string
	name: string
	requested: number
	available: number
}

type ConfirmationHandler = (items: InsufficientStockItem[]) => Promise<boolean>

let confirmationHandler: ConfirmationHandler | null = null

export const setInsufficientStockConfirmationHandler = (
	handler: ConfirmationHandler | null,
): void => {
	confirmationHandler = handler
}

export const requestInsufficientStockConfirmation = async (
	items: InsufficientStockItem[],
): Promise<boolean> => {
	if (!confirmationHandler) return false
	return confirmationHandler(items)
}

export class InsufficientStockCancelledError extends Error {
	constructor() {
		super('Insufficient stock confirmation cancelled')
		this.name = 'InsufficientStockCancelledError'
	}
}
