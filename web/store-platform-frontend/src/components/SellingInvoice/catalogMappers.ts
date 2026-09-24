import type { ProductCatalogItem } from '../../api/apiStore'

export const mapCatalogItemToProduct = (item: ProductCatalogItem): Product => ({
	productId: item.productId,
	name: item.name,
	latinName: item.latinName,
	barcode: item.barcode,
	additionalBarcodes: item.additionalBarcodes,
	internalCode: item.internalCode,
	productFactoryCode: item.productFactoryCode,
	unitId: item.unitId,
	taxRate: item.taxRate,
	price: {
		retailPrice: item.price.retailPrice,
		purchasePrice: item.price.purchasePrice,
		discount: item.price.discount,
		currency: item.price.currency,
	},
	inventory:
		item.averageCost != null
			? {
					inventoryId: '',
					productId: item.productId,
					averageCost: item.averageCost,
				}
			: undefined,
	lastSellingPrice: item.lastSellingPrice,
	lastBuyingPrice: item.lastBuyingPrice,
	images: item.images,
	status: 'active',
})

export const mapProductToCatalogItem = (
	product: Product,
): ProductCatalogItem => ({
	productId: product.productId,
	name: product.name,
	latinName: product.latinName,
	barcode: product.barcode ?? '',
	additionalBarcodes: product.additionalBarcodes,
	internalCode: product.internalCode,
	productFactoryCode: product.productFactoryCode,
	unitId: product.unitId,
	taxRate: product.taxRate,
	price: {
		retailPrice: product.price?.retailPrice ?? 0,
		purchasePrice: product.price?.purchasePrice,
		discount: product.price?.discount,
		currency: product.price?.currency ?? '',
	},
	averageCost: product.inventory?.averageCost,
	lastSellingPrice: product.lastSellingPrice,
	lastBuyingPrice: product.lastBuyingPrice,
	images: product.images?.length ? [product.images[0]] : undefined,
})

/** Overlay product identity/price onto an existing catalog row without dropping invoice-derived fields. */
export const mergeProductIntoCatalogItem = (
	existing: ProductCatalogItem | undefined,
	product: Product,
	options: { seeBuying: boolean; averageCost?: number },
): ProductCatalogItem => {
	const mapped = mapProductToCatalogItem(product)
	const seeBuying = options.seeBuying

	return {
		...existing,
		...mapped,
		barcode: mapped.barcode,
		additionalBarcodes: mapped.additionalBarcodes,
		price: {
			retailPrice: mapped.price.retailPrice,
			discount: mapped.price.discount,
			currency: mapped.price.currency,
			...(seeBuying ? { purchasePrice: mapped.price.purchasePrice } : {}),
		},
		averageCost: seeBuying ? options.averageCost : undefined,
		lastSellingPrice: existing?.lastSellingPrice ?? mapped.lastSellingPrice,
		lastBuyingPrice: seeBuying
			? (existing?.lastBuyingPrice ?? mapped.lastBuyingPrice)
			: undefined,
		images: existing?.images ?? mapped.images,
	}
}
