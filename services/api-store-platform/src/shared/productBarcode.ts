import { randomInt } from 'crypto'

import { BusinessLogicError } from '../middleware/errorHandler'
import { ERROR_CODES } from './errorCodes'
import { SEE } from './seeCatalog'
import { ensureSeeIds } from './seePermissions'
import { getTenantContext } from './tenant'
import { RequestContext } from './types'

export const MAX_PRODUCT_BARCODES = 10

export type ProductBarcodeFields = {
	productId: string
	barcode?: string | null
	additionalBarcodes?: string[] | null
}

export const barcodeCompareKey = (value: string): string =>
	value.trim().toLowerCase()

export const barcodeCollisionMessage = (barcode: string) =>
	`Barcode "${barcode}" is already used by another product.`

const BARCODE_COLLISION_MESSAGE_RE =
	/^Barcode ".+" is already used by another product\.$/

export const isBarcodeCollisionError = (error: unknown): boolean =>
	error instanceof BusinessLogicError &&
	BARCODE_COLLISION_MESSAGE_RE.test(error.message)

export const resolvedProductBarcode = (
	productId: string,
	barcode?: string | null,
): string => {
	const value = barcode?.trim() ?? ''

	return !value || value === productId ? '' : value
}

export const persistableProductBarcode = (
	productId: string,
	barcode?: string | null,
): string | undefined => resolvedProductBarcode(productId, barcode) || undefined

/** Unique barcodes in display order: primary first, then additional. */
export const allBarcodes = (product: ProductBarcodeFields): string[] => {
	const values = [product.barcode, ...(product.additionalBarcodes ?? [])]
	const out: string[] = []
	const seen = new Set<string>()

	for (const raw of values) {
		const value = resolvedProductBarcode(product.productId, raw)

		if (!value) continue

		const key = barcodeCompareKey(value)

		if (seen.has(key)) continue

		seen.add(key)
		out.push(value)

		if (out.length >= MAX_PRODUCT_BARCODES) break
	}

	return out
}

/**
 * Normalize primary + additional into canonical shape (promote first when
 * primary empty). Throws when more than MAX unique barcodes are supplied.
 */
export const normalizeProductBarcodes = (
	productId: string,
	barcode?: string | null,
	additionalBarcodes?: string[] | null,
): { barcode?: string; additionalBarcodes: string[] } => {
	const values = [barcode, ...(additionalBarcodes ?? [])]
	const unique: string[] = []
	const seen = new Set<string>()

	for (const raw of values) {
		const value = resolvedProductBarcode(productId, raw)

		if (!value) continue

		const key = barcodeCompareKey(value)

		if (seen.has(key)) continue

		seen.add(key)
		unique.push(value)
	}

	if (unique.length > MAX_PRODUCT_BARCODES) {
		throw new BusinessLogicError(
			ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
			`A product can have at most ${MAX_PRODUCT_BARCODES} barcodes.`,
		)
	}

	return {
		barcode: unique[0],
		additionalBarcodes: unique.slice(1),
	}
}

/** Split one import cell on `;` into primary + additional. */
export const parseImportBarcodeCell = (
	productId: string,
	cell?: string | null,
): { barcode?: string; additionalBarcodes: string[]; error?: string } => {
	if (cell == null || !String(cell).trim()) {
		return { additionalBarcodes: [] }
	}

	const parts = String(cell).split(';')

	try {
		return normalizeProductBarcodes(productId, parts[0], parts.slice(1))
	} catch {
		return {
			additionalBarcodes: [],
			error: `A product can have at most ${MAX_PRODUCT_BARCODES} barcodes.`,
		}
	}
}

export const barcodeSetsEqual = (
	productId: string,
	a: {
		barcode?: string | null
		additionalBarcodes?: string[] | null
	},
	b: {
		barcode?: string | null
		additionalBarcodes?: string[] | null
	},
): boolean => {
	const left = allBarcodes({ productId, ...a })
		.map(barcodeCompareKey)
		.sort()
	const right = allBarcodes({ productId, ...b })
		.map(barcodeCompareKey)
		.sort()

	if (left.length !== right.length) return false

	return left.every((key, index) => key === right[index])
}

export const PRINTABLE_BARCODE_MAX_ATTEMPTS = 8

export const generatePrintableBarcode = (): string =>
	randomInt(0, 1_000_000_000).toString().padStart(9, '0')

export const ensurePrintableProductBarcode = async (
	productId: string,
	requestContext: RequestContext,
	io: {
		findProduct: (
			productId: string,
			tenantId: string,
		) => Promise<{ barcode?: string | null } | null>
		persistBarcode: (productId: string, barcode: string) => Promise<void>
		/** Tenant uniqueness; must exclude `productId` so the current product is allowed. */
		assertBarcodeAvailable: (barcode: string) => Promise<void>
		generateBarcode?: () => string
	},
): Promise<{ barcode: string }> => {
	await ensureSeeIds(requestContext, [SEE.productsPrintBarcode])
	const { tenantId } = getTenantContext(requestContext)
	const existing = await io.findProduct(productId, tenantId)

	if (!existing) {
		throw new BusinessLogicError(
			ERROR_CODES.DOCUMENTS.DOCUMENT_UPDATE_ERROR,
			'products not found.',
		)
	}

	const current = resolvedProductBarcode(productId, existing.barcode)

	if (current) {
		return { barcode: current }
	}

	const nextBarcode = io.generateBarcode ?? generatePrintableBarcode

	// note: app-level check can still race under concurrent generate. Upgrade: unique index + retry.
	for (let attempt = 0; attempt < PRINTABLE_BARCODE_MAX_ATTEMPTS; attempt++) {
		const barcode = nextBarcode()

		try {
			await io.assertBarcodeAvailable(barcode)
			await io.persistBarcode(productId, barcode)

			return { barcode }
		} catch (error) {
			if (!isBarcodeCollisionError(error)) throw error
		}
	}

	throw new BusinessLogicError(
		ERROR_CODES.BUSINESS_LOGIC.GENERAL_BUSINESS_LOGIC_ERROR,
		'Could not generate a unique printable barcode.',
	)
}
