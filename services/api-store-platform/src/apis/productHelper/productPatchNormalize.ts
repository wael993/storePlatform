import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../../shared/errorCodes'
import type { InventoryRequestBody } from '../../shared/types'

type ProductPrice = {
	purchasePrice?: number
	retailPrice: number
	wholesalePrice?: number
	semiWholesalePrice?: number
	discount?: number
	currency: string
}

type ProductPricePatch = Partial<ProductPrice>

export type ProductPatchBody = {
	name?: string
	latinName?: string
	barcode?: string
	internalCode?: string
	productFactoryCode?: string
	categoryId?: string
	supplierId?: string
	brandId?: string
	taxRate?: string
	unitId?: string
	price?: ProductPricePatch
	status?: 'active' | 'inactive' | 'discontinued'
	attributes?: {
		color?: string
		size?: string
		weight?: string
		length?: string
		width?: string
		height?: string
		flavor?: string
		expiryDate?: string
	}
	images?: string[]
	description?: string
}

const PRODUCT_PATCH_KEYS = [
	'name',
	'latinName',
	'barcode',
	'internalCode',
	'productFactoryCode',
	'categoryId',
	'supplierId',
	'brandId',
	'taxRate',
	'unitId',
	'price',
	'status',
	'attributes',
	'images',
	'description',
] as const satisfies ReadonlyArray<keyof ProductPatchBody>

const INVENTORY_PATCH_KEYS = [
	'productId',
	'warehouseId',
	'shelfId',
	'quantity',
	'minQuantity',
] as const satisfies ReadonlyArray<keyof InventoryRequestBody>

export const normalizeOptionalNumberField = (
	value: unknown,
	fieldName: string,
): number => {
	if (typeof value === 'number') {
		if (Number.isNaN(value) || value < 0) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				`Invalid value for ${fieldName}.`,
			)
		}

		return value
	}

	if (typeof value === 'string') {
		const parsedNumber = Number(value.split(',').join('').trim())

		if (Number.isNaN(parsedNumber) || parsedNumber < 0) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				`Invalid value for ${fieldName}.`,
			)
		}

		return parsedNumber
	}

	throw new BusinessLogicError(
		ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
		`Invalid value for ${fieldName}.`,
	)
}

export function normalizeOptionalStringField(
	value: unknown,
	fieldName: string,
): string {
	if (typeof value !== 'string') {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			`Invalid value for ${fieldName}.`,
		)
	}

	const trimmedValue = value.trim()

	if (!trimmedValue) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			`Invalid value for ${fieldName}.`,
		)
	}

	return trimmedValue
}

const pickDefinedKeys = <T extends string>(
	body: Record<string, unknown>,
	keys: readonly T[],
): Partial<Record<T, unknown>> => {
	const picked: Partial<Record<T, unknown>> = {}

	for (const key of keys) {
		if (body[key] !== undefined) {
			picked[key] = body[key]
		}
	}

	return picked
}

const normalizePricePatch = (price: unknown): ProductPricePatch => {
	if (!price || typeof price !== 'object' || Array.isArray(price)) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'Invalid value for price.',
		)
	}

	const priceBody = price as Record<string, unknown>
	const normalizedPrice: ProductPricePatch = {}

	if (priceBody.purchasePrice !== undefined) {
		normalizedPrice.purchasePrice = normalizeOptionalNumberField(
			priceBody.purchasePrice,
			'price.purchasePrice',
		)
	}

	if (priceBody.retailPrice !== undefined) {
		normalizedPrice.retailPrice = normalizeOptionalNumberField(
			priceBody.retailPrice,
			'price.retailPrice',
		)
	}

	if (priceBody.wholesalePrice !== undefined) {
		normalizedPrice.wholesalePrice = normalizeOptionalNumberField(
			priceBody.wholesalePrice,
			'price.wholesalePrice',
		)
	}

	if (priceBody.semiWholesalePrice !== undefined) {
		normalizedPrice.semiWholesalePrice = normalizeOptionalNumberField(
			priceBody.semiWholesalePrice,
			'price.semiWholesalePrice',
		)
	}

	if (priceBody.discount !== undefined) {
		normalizedPrice.discount = normalizeOptionalNumberField(
			priceBody.discount,
			'price.discount',
		)
	}

	if (priceBody.currency !== undefined) {
		normalizedPrice.currency = normalizeOptionalStringField(
			priceBody.currency,
			'price.currency',
		)
	}

	if (Object.keys(normalizedPrice).length === 0) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'Invalid value for price.',
		)
	}

	return normalizedPrice
}

export const normalizeProductPatchRequest = (
	requestBody: unknown,
): ProductPatchBody => {
	if (
		!requestBody ||
		typeof requestBody !== 'object' ||
		Array.isArray(requestBody)
	) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'No valid fields to update.',
		)
	}

	const picked = pickDefinedKeys(
		requestBody as Record<string, unknown>,
		PRODUCT_PATCH_KEYS,
	)
	const normalized: ProductPatchBody = {}

	if (picked.name !== undefined) {
		normalized.name = normalizeOptionalStringField(picked.name, 'name')
	}

	if (picked.latinName !== undefined) {
		normalized.latinName = normalizeOptionalStringField(
			picked.latinName,
			'latinName',
		)
	}

	if (picked.barcode !== undefined) {
		normalized.barcode = normalizeOptionalStringField(picked.barcode, 'barcode')
	}

	if (picked.internalCode !== undefined) {
		normalized.internalCode = normalizeOptionalStringField(
			picked.internalCode,
			'internalCode',
		)
	}

	if (picked.productFactoryCode !== undefined) {
		normalized.productFactoryCode = normalizeOptionalStringField(
			picked.productFactoryCode,
			'productFactoryCode',
		)
	}

	if (picked.categoryId !== undefined) {
		normalized.categoryId = normalizeOptionalStringField(
			picked.categoryId,
			'categoryId',
		)
	}

	if (picked.supplierId !== undefined) {
		normalized.supplierId = normalizeOptionalStringField(
			picked.supplierId,
			'supplierId',
		)
	}

	if (picked.brandId !== undefined) {
		normalized.brandId = normalizeOptionalStringField(picked.brandId, 'brandId')
	}

	if (picked.taxRate !== undefined) {
		normalized.taxRate = normalizeOptionalStringField(picked.taxRate, 'taxRate')
	}

	if (picked.unitId !== undefined) {
		normalized.unitId = normalizeOptionalStringField(picked.unitId, 'unitId')
	}

	if (picked.description !== undefined) {
		normalized.description = normalizeOptionalStringField(
			picked.description,
			'description',
		)
	}

	if (picked.status !== undefined) {
		if (
			picked.status !== 'active' &&
			picked.status !== 'inactive' &&
			picked.status !== 'discontinued'
		) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Invalid value for status.',
			)
		}

		normalized.status = picked.status
	}

	if (picked.price !== undefined) {
		normalized.price = normalizePricePatch(picked.price)
	}

	if (picked.attributes !== undefined) {
		if (
			!picked.attributes ||
			typeof picked.attributes !== 'object' ||
			Array.isArray(picked.attributes)
		) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Invalid value for attributes.',
			)
		}

		normalized.attributes = picked.attributes as ProductPatchBody['attributes']
	}

	if (picked.images !== undefined) {
		if (
			!Array.isArray(picked.images) ||
			picked.images.some(image => typeof image !== 'string')
		) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
				'Invalid value for images.',
			)
		}

		normalized.images = picked.images
	}

	if (Object.keys(normalized).length === 0) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'No valid fields to update.',
		)
	}

	return normalized
}

export const normalizeInventoryPatchRequest = (
	requestBody: unknown,
): Partial<InventoryRequestBody> => {
	if (
		!requestBody ||
		typeof requestBody !== 'object' ||
		Array.isArray(requestBody)
	) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'No valid fields to update.',
		)
	}

	const picked = pickDefinedKeys(
		requestBody as Record<string, unknown>,
		INVENTORY_PATCH_KEYS,
	)
	const normalized: Partial<InventoryRequestBody> = {}

	if (picked.productId !== undefined) {
		normalized.productId = normalizeOptionalStringField(
			picked.productId,
			'productId',
		)
	}

	if (picked.warehouseId !== undefined) {
		normalized.warehouseId = normalizeOptionalStringField(
			picked.warehouseId,
			'warehouseId',
		)
	}

	if (picked.shelfId !== undefined) {
		normalized.shelfId = normalizeOptionalStringField(picked.shelfId, 'shelfId')
	}

	if (picked.quantity !== undefined) {
		normalized.quantity = normalizeOptionalNumberField(
			picked.quantity,
			'quantity',
		)
	}

	if (picked.minQuantity !== undefined) {
		normalized.minQuantity = normalizeOptionalNumberField(
			picked.minQuantity,
			'minQuantity',
		)
	}

	if (Object.keys(normalized).length === 0) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'No valid fields to update.',
		)
	}

	return normalized
}

export const mergeProductPricePatch = (
	existingPrice: ProductPrice | undefined,
	pricePatch: ProductPricePatch,
): ProductPrice => {
	return {
		purchasePrice: existingPrice?.purchasePrice,
		wholesalePrice: existingPrice?.wholesalePrice,
		semiWholesalePrice: existingPrice?.semiWholesalePrice,
		discount: existingPrice?.discount,
		retailPrice: existingPrice?.retailPrice ?? 0,
		currency: existingPrice?.currency ?? 'SYP',
		...pricePatch,
	}
}
