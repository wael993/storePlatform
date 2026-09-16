import { randomInt } from 'crypto'

import { BusinessLogicError } from '../middleware/errorHandler'
import { ERROR_CODES } from './errorCodes'
import { SEE } from './seeCatalog'
import { ensureSeeIds } from './seePermissions'
import { getTenantContext } from './tenant'
import { RequestContext } from './types'

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

export const generatePrintableBarcode = (): string =>
	// note: 9-digit random, no uniqueness check; collision grows with catalog size. Upgrade: retry on tenant barcode or a sequential counter.
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

	const barcode = generatePrintableBarcode()

	await io.persistBarcode(productId, barcode)

	return { barcode }
}
