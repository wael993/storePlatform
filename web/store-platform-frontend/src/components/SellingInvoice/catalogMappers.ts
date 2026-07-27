import type { ProductCatalogItem } from '../../api/apiStore'

export const mapCatalogItemToProduct = (item: ProductCatalogItem): Product => ({
	productId: item.productId,
	name: item.name,
	latinName: item.latinName,
	barcode: item.barcode,
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
