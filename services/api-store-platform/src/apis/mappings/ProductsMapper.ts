import { ca } from 'date-fns/locale'
import {
	ProductAPI,
	ProductAPIEnriched,
	ProductRequestBody,
	RequestContext,
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
			categoryName: product.category?.name,
			brandId: product.brandId,
			brandName: product.brand?.name,
			images: product.images,
			price: product.price,
			stock: product.stock,
			unit: product.unit,
			tax: product.tax,
			supplierId: product.supplierId,
			supplierName: product.supplier?.name,
			location: product.location,
			attributes: product.attributes,
			status: product.status,
			description: isOwnerUser ? product.description : undefined,
		}
		return mappedProducts
	}

	public async enrichProduct(
		product: ProductAPI,
		tenantId: string,
	): Promise<ProductAPIEnriched> {
		const [brand, category, supplier] = await Promise.all([
			product.brandId
				? Brand.findOne({ _id: product.brandId, tenantId })
				: Promise.resolve(null),
			product.categoryId
				? Category.findOne({ _id: product.categoryId, tenantId })
				: Promise.resolve(null),
			product.supplierId
				? Supplier.findOne({ _id: product.supplierId, tenantId })
				: Promise.resolve(null),
		])

		const enrichedProduct: ProductAPIEnriched = {
			productId: product.productId,
			productFactoryCode: product.productFactoryCode,
			name: product.name,
			barcode: product.barcode,
			images: product.images,
			price: product.price,
			stock: product.stock,
			unit: product.unit,
			tax: product.tax,
			location: product.location,
			attributes: product.attributes,
			status: product.status,
			description: product.description,
			...(brand && {
				brand: {
					_id: (brand._id as unknown as string).toString(),
					name: brand.name,
				},
			}),
			...(category && {
				category: {
					_id: (category._id as unknown as string).toString(),
					name: category.name,
				},
			}),
			...(supplier && {
				supplier: {
					_id: (supplier._id as unknown as string).toString(),
					name: supplier.name,
				},
			}),
		}

		return enrichedProduct
	}
}
