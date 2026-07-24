import type { SellingInvoiceLineItem } from './types'

const DEFAULT_TAX_RATE = 15

export const createLineItemFromProduct = (product: Product): SellingInvoiceLineItem => {
	const taxRate = Number.parseFloat(product.taxRate ?? '') || DEFAULT_TAX_RATE

	return {
		id: `${product.productId}-${Date.now()}`,
		productId: product.productId,
		name: product.name,
		modelCode: product.productFactoryCode ?? product.internalCode,
		barcode: product.barcode,
		imageUrl: product.images?.[0],
		quantity: 1,
		unit: product.unitId ?? 'pcs',
		unitPrice: product.price?.retailPrice ?? 0,
		discount: product.price?.discount ?? 0,
		discountIsPercent: true,
		taxRate,
		averageCost: product.inventory?.averageCost,
		lastBuyingPrice: product.price?.purchasePrice,
		lastSellingPrice: product.price?.retailPrice,
	}
}

export const addProductToLineItems = (
	lineItems: SellingInvoiceLineItem[],
	product: Product,
) => {
	const existingIndex = lineItems.findIndex(
		item => item.productId === product.productId,
	)

	if (existingIndex === -1) {
		return [...lineItems, createLineItemFromProduct(product)]
	}

	return lineItems.map((item, index) =>
		index === existingIndex
			? { ...item, quantity: item.quantity + 1 }
			: item,
	)
}
