import { parseNumberValue } from '../../shared/utils'

export type ProductInlineField =
	| 'name'
	| 'barcode'
	| 'purchasePrice'
	| 'retailPrice'
	| 'discount'
	| 'quantity'
	| 'minQuantity'

type ProductPatchBody = Partial<Omit<Product, 'productId' | 'price'>> & {
	price?: Partial<Product['price']>
}

type InventoryPatchBody = {
	readonly warehouseId: string
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

	const normalized = parseNumberValue(value.trim())
	const parsedValue = Number(normalized)

	if (!normalized || Number.isNaN(parsedValue)) {
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

const buildPriceFieldPatch = (
	pricePatch: Partial<Product['price']>,
): ProductPatchBody => ({
	price: pricePatch,
})

const requireInventoryTarget = (
	product: Product,
): { inventoryId: string; warehouseId: string } => {
	const inventoryId = product.inventory?.inventoryId?.trim()
	const warehouseId = product.inventory?.warehouseId?.trim()

	if (!inventoryId || !warehouseId) {
		throw new Error('NO_INVENTORY')
	}

	return { inventoryId, warehouseId }
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
		buildPatch: (_product, raw) => ({
			persist: 'product',
			body: buildPriceFieldPatch({
				purchasePrice: parseInlineNumber(raw),
			}),
		}),
	},
	retailPrice: {
		errorKey: 'common.sellPrice',
		buildPatch: (_product, raw) => ({
			persist: 'product',
			body: buildPriceFieldPatch({ retailPrice: parseInlineNumber(raw) }),
		}),
	},
	discount: {
		errorKey: 'common.discount',
		buildPatch: (_product, raw) => ({
			persist: 'product',
			body: buildPriceFieldPatch({ discount: parseInlineNumber(raw) }),
		}),
	},
	quantity: {
		errorKey: 'productModal.quantityRequired',
		buildPatch: (product, raw) => {
			const { warehouseId } = requireInventoryTarget(product)

			return {
				persist: 'inventory',
				productId: product.productId,
				body: {
					warehouseId,
					quantity: parseInlineNumber(raw),
				},
			}
		},
	},
	minQuantity: {
		errorKey: 'productModal.minQuantityInvalid',
		buildPatch: (product, raw) => {
			const { warehouseId } = requireInventoryTarget(product)

			return {
				persist: 'inventory',
				productId: product.productId,
				body: {
					warehouseId,
					minQuantity: parseInlineNumber(raw),
				},
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
