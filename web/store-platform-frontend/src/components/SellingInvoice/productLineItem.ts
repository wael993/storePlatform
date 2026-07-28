import type { SellingInvoiceLineItem } from './types'

const DEFAULT_TAX_RATE = 15

export type InvoiceLineItemKind = 'selling' | 'buying'

const getDefaultUnitPrice = (product: Product, kind: InvoiceLineItemKind) =>
	kind === 'buying'
		? (product.price?.purchasePrice ?? 0)
		: (product.price?.retailPrice ?? 0)

const getLastBuyingPrice = (product: Product) =>
	product.lastBuyingPrice ?? product.price?.purchasePrice

export const syncLineItemCostReferences = (
	lineItems: SellingInvoiceLineItem[],
	products: Product[],
): SellingInvoiceLineItem[] => {
	if (lineItems.length === 0 || products.length === 0) return lineItems

	const productsById = new Map(
		products.map(product => [product.productId, product]),
	)
	let changed = false

	const next = lineItems.map(item => {
		const product = productsById.get(item.productId)
		if (!product) return item

		const averageCost = product.inventory?.averageCost ?? item.averageCost
		const lastBuyingPrice = getLastBuyingPrice(product) ?? item.lastBuyingPrice
		const lastSellingPrice = product.lastSellingPrice ?? item.lastSellingPrice

		if (
			averageCost === item.averageCost &&
			lastBuyingPrice === item.lastBuyingPrice &&
			lastSellingPrice === item.lastSellingPrice
		) {
			return item
		}

		changed = true
		return { ...item, averageCost, lastBuyingPrice, lastSellingPrice }
	})

	return changed ? next : lineItems
}

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
		lastBuyingPrice: getLastBuyingPrice(product),
		lastSellingPrice: product.lastSellingPrice,
	}
}

export const addProductToLineItems = (
	lineItems: SellingInvoiceLineItem[],
	product: Product,
	kind: InvoiceLineItemKind = 'selling',
	options?: { noMergeInvoiceLines?: boolean },
) => {
	if (options?.noMergeInvoiceLines) {
		return [...lineItems, createLineItemFromProduct(product, kind)]
	}

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
					lastBuyingPrice: getLastBuyingPrice(product) ?? item.lastBuyingPrice,
					lastSellingPrice: product.lastSellingPrice ?? item.lastSellingPrice,
				}
			: item,
	)
}
