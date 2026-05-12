import {
	ProductAPI,
	ProductRequestBody,
	RequestContext,
} from '../../shared/types'

export default class ProductsMapper {
	public mapProduct(
		product: ProductAPI,
		requestContext: RequestContext,
	): ProductRequestBody {
		const isAdminUser = requestContext.user?.role === 'admin'
		const isOwnerUser = requestContext.user?.role === 'owner'

		const mappedProducts: ProductRequestBody = {
			productId: product.productId,
			name: product.name,
			barcode: product.barcode,
			brand: product.brand,
			images: product.images,
			category: product.category,
			price: product.price,
			stock: product.stock,
			tax: product.tax,
			supplier: product.supplier,
			location: product.location,
			attributes: product.attributes,
			status: product.status,
			description: isOwnerUser ? product.description : undefined,
		}
		return mappedProducts
	}
}
