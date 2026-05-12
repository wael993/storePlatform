import { ProductRequestBody, RequestContext } from '../../shared/types'

interface ProductAPI {
	productId: string
	name: string
	barcode: string
	brand?: string
	images?: string[]
	category?: { id: string; name: string }
	price: { buy: number; sell: number; discount?: number; currency: string }
	stock: { quantity: number; minQuantity?: number; unit?: string }
	tax?: { type: string; value: number }
	supplier?: { id?: string; name?: string }
	location?: { warehouse?: string; shelf?: string }
	attributes?: {
		color?: string
		size?: string
		flavor?: string
		expiryDate?: string
		weight?: string
	}
	status?: string
	description?: string
}

export default class ProductsMapper {
	public mapProduct(
		product: any, //ProductAPI,
		requestContext: RequestContext,
	): ProductRequestBody {
		const isInternalUser = requestContext.user?.isInternal
		console.log(
			'🚀 ~ ProductsMapper ~ mapProduct ~ requestContext:',
			requestContext,
		)
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
			description: isInternalUser ? product.description : undefined,
		}
		return mappedProducts
	}
}
