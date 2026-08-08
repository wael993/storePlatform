export type ProductInlineField =
	| 'name'
	| 'barcode'
	| 'purchasePrice'
	| 'retailPrice'
	| 'discount'
	| 'quantity'
	| 'minQuantity'

type ProductPatchBody = Partial<Omit<Product, 'productId'>>

type InventoryPatchBody = {
	readonly quantity?: number
	readonly minQuantity?: number
}

export type ProductInlinePatch =
	| {
			readonly persist: 'product'
			readonly body: ProductPatchBody
	  }
	| {
			readonly persist: 'inventory'
			readonly productId: string
			readonly body: InventoryPatchBody
	  }

interface ProductInlineFieldConfig {
	readonly errorKey: string
	readonly buildPatch: (product: Product, raw?: string) => ProductInlinePatch
}

export function parseInlineNumber(value?: string): number {
	if (!value?.trim()) {
		throw new Error('NO_VALUE')
	}

	const parsedValue = Number(value.replaceAll(',', '').trim())

	if (Number.isNaN(parsedValue)) {
		throw new Error('INVALID_NUMBER')
	}

	return parsedValue
}

export function parseInlineString(value?: string): string {
	const trimmed = value?.trim()

	if (!trimmed) {
		throw new Error('NO_VALUE')
	}

	return trimmed
}

const buildPriceBody = (
	product: Product,
	pricePatch: Partial<Product['price']>,
): ProductPatchBody => ({
	price: {
		...product.price,
		...pricePatch,
	},
})

const requireInventoryId = (product: Product): string => {
	const inventoryId = product.inventory?.inventoryId

	if (!inventoryId) {
		throw new Error('NO_INVENTORY')
	}

	return inventoryId
}

export const PRODUCT_INLINE_FIELD_CONFIG = {
	name: {
		errorKey: 'productModal.nameBarcodeRequired',
		buildPatch: (_product, raw) => ({
			persist: 'product',
			body: { name: parseInlineString(raw) },
		}),
	},
	barcode: {
		errorKey: 'productModal.nameBarcodeRequired',
		buildPatch: (_product, raw) => ({
			persist: 'product',
			body: { barcode: parseInlineString(raw) },
		}),
	},
	purchasePrice: {
		errorKey: 'components.activityDetail.topSection.buyCostNoValue',
		buildPatch: (product, raw) => ({
			persist: 'product',
			body: buildPriceBody(product, {
				purchasePrice: parseInlineNumber(raw),
			}),
		}),
	},
	retailPrice: {
		errorKey: 'common.sellPrice',
		buildPatch: (product, raw) => ({
			persist: 'product',
			body: buildPriceBody(product, { retailPrice: parseInlineNumber(raw) }),
		}),
	},
	discount: {
		errorKey: 'common.discount',
		buildPatch: (product, raw) => ({
			persist: 'product',
			body: buildPriceBody(product, { discount: parseInlineNumber(raw) }),
		}),
	},
	quantity: {
		errorKey: 'productModal.quantityRequired',
		buildPatch: (product, raw) => {
			requireInventoryId(product)

			return {
				persist: 'inventory',
				productId: product.productId,
				body: { quantity: parseInlineNumber(raw) },
			}
		},
	},
	minQuantity: {
		errorKey: 'productModal.minQuantityInvalid',
		buildPatch: (product, raw) => {
			requireInventoryId(product)

			return {
				persist: 'inventory',
				productId: product.productId,
				body: { minQuantity: parseInlineNumber(raw) },
			}
		},
	},
} as const satisfies Record<ProductInlineField, ProductInlineFieldConfig>

export function buildProductInlinePatch(
	product: Product,
	field: ProductInlineField,
	rawValue?: string,
): ProductInlinePatch {
	return PRODUCT_INLINE_FIELD_CONFIG[field].buildPatch(product, rawValue)
}
