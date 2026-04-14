import { ProductRequestBody, RequestContext } from '../../shared/types'

interface ProductAPI {
	ProductId: string
	id: string
	name: string
	barcode: string
	price: number | null
	description?: string
	count: number
}

export default class ProductsMapper {
	public mapProduct(
		product: any, //ProductAPI,
		requestContext: RequestContext,
	): ProductRequestBody {
		const isInternalUser = requestContext.user?.isInternal
		const mappedProducts: ProductRequestBody = {
			id: product.ProductId,
			name: product.name,
			barcode: product.barcode,
			price: isInternalUser ? product.price : null,
			count: product.count,
			description: product.description,
		}
		return mappedProducts
	}
}
