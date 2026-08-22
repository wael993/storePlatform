import {
	ProductAPI,
	ProductRequestBody,
	RequestContext,
	InventoryDocument,
} from '../../shared/types'

export type ProductRelationLookups = {
	categoryNameById: Map<string, string>
	supplierNameById: Map<string, string>
	brandNameById: Map<string, string>
	unitNameById: Map<string, string>
	shelfNameById: Map<string, string>
	warehouseNameById: Map<string, string>
}

export default class ProductsMapper {
	public mapProduct(
		product: ProductAPI,
		inventory: InventoryDocument | undefined,
		requestContext: RequestContext,
		lookups?: ProductRelationLookups,
	): ProductRequestBody {
		const isOwnerUser = requestContext.user?.role === 'owner'

		const mappedProduct: ProductRequestBody = {
			productId: product.productId,
			productFactoryCode: product.productFactoryCode,
			name: product.name,
			barcode: product.barcode || '',
			internalCode: product.internalCode,
			latinName: product.latinName,
			categoryId: product.categoryId,
			categoryName: product.categoryId
				? lookups?.categoryNameById.get(product.categoryId)
				: undefined,
			brandId: product.brandId,
			brandName: product.brandId
				? lookups?.brandNameById.get(product.brandId)
				: undefined,
			images: product.images,
			status: product.status ?? 'active',
			price: product.price,
			unitId: product.unitId,
			unitName: product.unitId
				? lookups?.unitNameById.get(product.unitId)
				: undefined,
			taxRate: product.taxRate,
			supplierId: product.supplierId,
			supplierName: product.supplierId
				? lookups?.supplierNameById.get(product.supplierId)
				: undefined,
			attributes: product.attributes,
			description: isOwnerUser ? product.description : undefined,
			inventory,
			warehouseName: inventory?.warehouseId
				? lookups?.warehouseNameById.get(inventory.warehouseId)
				: undefined,
			shelfName: inventory?.shelfId
				? lookups?.shelfNameById.get(inventory.shelfId)
				: undefined,
		}

		return mappedProduct
	}
}
