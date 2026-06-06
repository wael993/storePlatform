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

		const productState = () => {
			if (product.status === 'inactive') return 'inactive'
			if (product?.stock?.quantity === 0) return 'outOfStock'
			if (
				product?.stock?.minQuantity &&
				product?.stock?.quantity &&
				product.stock.quantity <= product.stock.minQuantity
			)
				return 'readyForRestock'
			if (product.status === 'discontinued') return 'discontinued'
			if (product.status === 'active') return 'active'

			return 'draft'
		}

		const mappedProducts: ProductRequestBody = {
			productId: product._id,
			productFactoryCode: product.productFactoryCode,
			name: product.name,
			barcode: product.barcode,
			state: productState(),
			categoryId: product.categoryId,
			categoryName: product.categoryName,
			brandId: product.brandId,
			brandName: product.brandName,
			images: product.images,
			price: product.price,
			stock: product.stock,
			unit: product.unit,
			tax: product.tax,
			supplierId: product.supplierId,
			supplierName: product.supplierName,
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
			_id: product._id,
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
