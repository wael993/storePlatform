import {
	ProductAPI,
	ProductRequestBody,
	RequestContext,
	ProductAPIEnriched,
} from '../../shared/types'
import { Brand } from '../../models/Brand'
import { Category } from '../../models/Category'
import { Supplier } from '../../models/Supplier'

export default class ProductsMapper {
	public mapProduct(
		product: ProductAPI,
		requestContext: RequestContext,
	): ProductRequestBody {
		const isAdminUser = requestContext.user?.role === 'admin'
		const isOwnerUser = requestContext.user?.role === 'owner'

		const mappedProducts: ProductRequestBody = {
			productId: product.productId,
			productFactoryCode: product.productFactoryCode,
			name: product.name,
			barcode: product.barcode,
			categoryId: product.categoryId,
			brandId: product.brandId,
			images: product.images,
			price: product.price,
			stock: product.stock,
			unit: product.unit,
			tax: product.tax,
			supplierId: product.supplierId,
			location: product.location,
			attributes: product.attributes,
			status: product.status,
			description: isOwnerUser ? product.description : undefined,
		}
		return mappedProducts
	}
}
