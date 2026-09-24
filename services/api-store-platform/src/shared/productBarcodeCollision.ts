import { BusinessLogicError } from '../middleware/errorHandler'
import { Product } from '../models/Products'
import { ERROR_CODES } from './errorCodes'
import { withTenantScope } from './mongodb/tenantScopedModel'
import {
	allBarcodes,
	barcodeCollisionMessage,
	barcodeCompareKey,
	type ProductBarcodeFields,
} from './productBarcode'

const escapeRegex = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Returns the conflicting barcode value, or null if free. */
export const findTenantBarcodeCollision = async (
	tenantId: string,
	codes: string[],
	excludeProductId?: string,
): Promise<string | null> => {
	const uniqueKeys = [
		...new Set(codes.map(code => barcodeCompareKey(code)).filter(Boolean)),
	]

	if (uniqueKeys.length === 0) return null

	for (const key of uniqueKeys) {
		const source = codes.find(code => barcodeCompareKey(code) === key) ?? key
		const re = new RegExp(`^${escapeRegex(source)}$`, 'i')
		const hit = await withTenantScope(
			Product.findOne({
				...(excludeProductId ? { productId: { $ne: excludeProductId } } : {}),
				$or: [{ barcode: re }, { additionalBarcodes: re }],
			})
				.select({ productId: 1, barcode: 1, additionalBarcodes: 1 })
				.lean<ProductBarcodeFields | null>(),
			tenantId,
		)

		if (hit) {
			const matched =
				allBarcodes(hit).find(code => barcodeCompareKey(code) === key) ?? source

			return matched
		}
	}

	return null
}

export const assertNoTenantBarcodeCollision = async (
	tenantId: string,
	codes: string[],
	excludeProductId?: string,
) => {
	const conflict = await findTenantBarcodeCollision(
		tenantId,
		codes,
		excludeProductId,
	)

	if (conflict) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			barcodeCollisionMessage(conflict),
		)
	}
}

/** Commit/write path: assert every product in a batch before insertMany. */
export const assertNoTenantBarcodeCollisionsForProducts = async (
	tenantId: string,
	products: ProductBarcodeFields[],
	assertOne: typeof assertNoTenantBarcodeCollision = assertNoTenantBarcodeCollision,
) => {
	for (const product of products) {
		await assertOne(tenantId, allBarcodes(product), product.productId)
	}
}
