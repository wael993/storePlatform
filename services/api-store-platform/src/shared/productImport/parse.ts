import { Workbook } from 'exceljs'
import { BusinessLogicError } from '../../middleware/errorHandler'
import { ERROR_CODES } from '../errorCodes'
import { PRODUCT_IMPORT_LIMITS } from '../constants/productImport'
import { SourceRow } from './mapRows'
import { findHeaderRowIndex, isTitleRow } from './headerRow'

export type ParsedImportFile = {
	fileName: string
	headers: string[]
	rows: SourceRow[]
}

const EXCEL_EXTENSIONS = new Set(['xlsx', 'xlsm'])

const cellText = (value: unknown): string => {
	if (value == null) return ''

	if (typeof value === 'object' && value !== null) {
		const record = value as Record<string, unknown>

		if ('text' in record) return cellText(record.text)

		if ('result' in record) return cellText(record.result)

		if ('richText' in record && Array.isArray(record.richText)) {
			return record.richText
				.map(part => cellText(asRecord(part)?.text))
				.join('')
		}
	}

	if (value instanceof Date) return value.toISOString().slice(0, 10)

	return String(value).trim()
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null

const uniqueHeaders = (headers: string[]): string[] => {
	const seen = new Map<string, number>()

	return headers.map(header => {
		const base = header.trim() || 'Column'
		const count = seen.get(base) ?? 0

		seen.set(base, count + 1)

		return count === 0 ? base : `${base} (${count + 1})`
	})
}

const rowTexts = (row: { values: unknown }): string[] => {
	const values = Array.isArray(row.values) ? row.values.slice(1) : []

	return values.map(cell => cellText(cell))
}

const parseExcel = async (
	bytes: Buffer,
	fileName: string,
): Promise<ParsedImportFile> => {
	const workbook = new Workbook()

	try {
		await workbook.xlsx.load(bytes as unknown as ArrayBuffer)
	} catch {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Could not read this Excel file. Please upload a valid .xlsx file.',
		)
	}

	const headers: string[] = []
	const rows: SourceRow[] = []
	const headerSet = new Set<string>()

	workbook.eachSheet(sheet => {
		const sheetRows: Array<{ rowNumber: number; texts: string[] }> = []

		sheet.eachRow((row, rowNumber) => {
			sheetRows.push({ rowNumber, texts: rowTexts(row) })
		})

		const headerIndex = findHeaderRowIndex(sheetRows.map(row => row.texts))

		if (headerIndex < 0) return

		const headerRow = sheetRows[headerIndex]
		const sheetHeaders = uniqueHeaders(
			headerRow.texts.map(text => text || 'Column'),
		)

		sheetHeaders.forEach(header => {
			if (!headerSet.has(header)) {
				headerSet.add(header)
				headers.push(header)
			}
		})

		for (const row of sheetRows.slice(headerIndex + 1)) {
			if (row.texts.every(text => !text) || isTitleRow(row.texts)) continue

			const record: Record<string, string> = {}

			sheetHeaders.forEach((header, index) => {
				record[header] = row.texts[index] ?? ''
			})

			rows.push({ fileName, rowNumber: row.rowNumber, values: record })
		}
	})

	return { fileName, headers, rows }
}

const extensionOf = (fileName: string) => {
	const parts = fileName.toLowerCase().split('.')

	return parts.length > 1 ? parts[parts.length - 1] : ''
}

export const isExcelImportFile = (_mimeType: string, fileName: string) =>
	EXCEL_EXTENSIONS.has(extensionOf(fileName))

export const parseImportFile = async (input: {
	bytes: Buffer
	mimeType: string
	fileName: string
}): Promise<ParsedImportFile> => {
	if (!isExcelImportFile(input.mimeType, input.fileName)) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'Only Excel files (.xlsx, .xlsm) are accepted.',
		)
	}

	return parseExcel(input.bytes, input.fileName)
}

export const assertImportLimits = (files: ParsedImportFile[]) => {
	const rowCount = files.reduce((sum, file) => sum + file.rows.length, 0)

	if (rowCount > PRODUCT_IMPORT_LIMITS.maxRows) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			`Import cannot exceed ${PRODUCT_IMPORT_LIMITS.maxRows} products.`,
		)
	}

	if (files.every(file => file.rows.length === 0)) {
		throw new BusinessLogicError(
			ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
			'No product rows were found in the uploaded files.',
		)
	}
}
