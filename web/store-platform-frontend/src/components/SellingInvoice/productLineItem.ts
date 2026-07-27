import type { SellingInvoiceLineItem } from './types'

const DEFAULT_TAX_RATE = 15

export type InvoiceLineItemKind = 'selling' | 'buying'

const getDefaultUnitPrice = (product: Product, kind: InvoiceLineItemKind) =>
	kind === 'buying'
		? (product.price?.purchasePrice ?? 0)
		: (product.price?.retailPrice ?? 0)

export const createLineItemFromProduct = (
	product: Product,
	kind: InvoiceLineItemKind = 'selling',
): SellingInvoiceLineItem => {
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
		unitPrice: getDefaultUnitPrice(product, kind),
		discount: product.price?.discount ?? 0,
		discountIsPercent: true,
		taxRate,
		averageCost: product.inventory?.averageCost,
		lastBuyingPrice: product.price?.purchasePrice,
		lastSellingPrice: product.lastSellingPrice,
	}
}

export const addProductToLineItems = (
	lineItems: SellingInvoiceLineItem[],
	product: Product,
	kind: InvoiceLineItemKind = 'selling',
) => {
	const existingIndex = lineItems.findIndex(
		item => item.productId === product.productId,
	)

	if (existingIndex === -1) {
		return [...lineItems, createLineItemFromProduct(product, kind)]
	}

	return lineItems.map((item, index) =>
		index === existingIndex
			? {
					...item,
					quantity: item.quantity + 1,
					averageCost: product.inventory?.averageCost ?? item.averageCost,
					lastBuyingPrice: product.price?.purchasePrice ?? item.lastBuyingPrice,
					lastSellingPrice: product.lastSellingPrice ?? item.lastSellingPrice,
				}
			: item,
	)
}
