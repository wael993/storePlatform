import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../../shared/errorCodes'
import {
	normalizeInventoryPatchRequest,
	normalizeProductPatchRequest,
	type ProductPatchBody,
} from './productPatchNormalize'

const PRODUCT_BULK_KEYS = [
	'categoryId',
	'supplierId',
	'unitId',
	'brandId',
] as const

export type BulkEditProductsRequest = {
	productIds: string[]
	productPatch: ProductPatchBody | null
	minQuantity?: number
	warehouseId?: string
}

const nonEmptyString = (value: unknown): string | undefined => {
	if (typeof value !== 'string') return undefined

	const trimmed = value.trim()

	return trimmed || undefined
}

/** Parse + validate bulk-edit body. Empty/unset fields are omitted. */
export const parseBulkEditProductsBody = (
	body: unknown,
): BulkEditProductsRequest => {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'Invalid bulk edit body.',
		)
	}

	const raw = body as Record<string, unknown>
	const productIds = [
		...new Set(
			(Array.isArray(raw.productIds) ? raw.productIds : [])
				.map(nonEmptyString)
				.filter((id): id is string => Boolean(id)),
		),
	]

	if (!productIds.length) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'productIds is required.',
		)
	}

	const patchSource: Record<string, unknown> = {}

	for (const key of PRODUCT_BULK_KEYS) {
		const value = nonEmptyString(raw[key])

		if (value !== undefined) patchSource[key] = value
	}

	const discountRaw =
		raw.price && typeof raw.price === 'object' && !Array.isArray(raw.price)
			? (raw.price as Record<string, unknown>).discount
			: raw.discount

	if (discountRaw !== undefined && discountRaw !== null && discountRaw !== '') {
		patchSource.price = { discount: discountRaw }
	}

	const productPatch = Object.keys(patchSource).length
		? normalizeProductPatchRequest(patchSource)
		: null

	let minQuantity: number | undefined

	if (
		raw.minQuantity !== undefined &&
		raw.minQuantity !== null &&
		raw.minQuantity !== ''
	) {
		minQuantity = normalizeInventoryPatchRequest({
			minQuantity: raw.minQuantity,
		}).minQuantity
	}

	const warehouseId = nonEmptyString(raw.warehouseId)

	if (!productPatch && minQuantity === undefined) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'No valid fields to update.',
		)
	}

	if (minQuantity !== undefined && !warehouseId) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'warehouseId is required when minQuantity is set.',
		)
	}

	return { productIds, productPatch, minQuantity, warehouseId }
}
