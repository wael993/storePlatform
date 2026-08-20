import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import { getInvoiceAiProvider } from './providers'
import { scoreInvoiceExtraction } from './score'
import {
	InvoiceDocumentInput,
	ScoredInvoiceExtraction,
} from './types'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = new Set([
	'application/pdf',
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/webp',
	'image/tiff',
	'image/bmp',
])

export const decodeInvoiceUpload = (body: {
	fileBase64?: unknown
	mimeType?: unknown
	fileName?: unknown
}): InvoiceDocumentInput => {
	const mimeType =
		typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : ''
	const fileBase64 =
		typeof body.fileBase64 === 'string' ? body.fileBase64.trim() : ''
	const fileName =
		typeof body.fileName === 'string' ? body.fileName.trim() : undefined

	if (!fileBase64 || !mimeType) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
			'fileBase64 and mimeType are required.',
		)
	}

	if (!ALLOWED_MIME.has(mimeType)) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Upload a PDF or image invoice (JPEG, PNG, WebP, TIFF, BMP).',
		)
	}

	const bytes = Buffer.from(
		fileBase64.replace(/^data:[^;]+;base64,/, ''),
		'base64',
	)

	if (!bytes.length) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Invoice file is empty or not valid base64.',
		)
	}

	if (bytes.length > MAX_BYTES) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Invoice file must be 8MB or smaller.',
		)
	}

	return { bytes, mimeType, fileName }
}

export const extractInvoice = async (
	input: InvoiceDocumentInput,
): Promise<ScoredInvoiceExtraction> => {
	const raw = await getInvoiceAiProvider().extract(input)

	return scoreInvoiceExtraction(raw)
}
