import {
	PRODUCT_IMPORT_FIELDS,
	REQUIRED_PRODUCT_IMPORT_FIELDS,
	type ProductImportField,
} from '../constants/productImport'
import {
	allBarcodes,
	barcodeCompareKey,
	parseImportBarcodeCell,
} from '../productBarcode'
import { normalizeMasterName, type MasterResolutions } from './masterData'

export type HeaderMapping = Partial<Record<ProductImportField, string | null>>

export type SourceRow = {
	fileName: string
	rowNumber: number
	fileIndex?: number
	values?: Record<string, string>
}

/** Copy fields — `{ ...mongooseSubdoc }` drops getter-backed `values`. */
export const toPlainSourceRow = (
	row: {
		fileName: string
		rowNumber: number
		values?: Record<string, string> | null
	},
	fileIndex?: number,
): SourceRow => ({
	fileName: row.fileName,
	rowNumber: row.rowNumber,
	values: row.values ?? {},
	...(fileIndex !== undefined ? { fileIndex } : {}),
})

export type MappedImportRow = {
	fileName: string
	rowNumber: number
	fileIndex?: number
	name: string
	barcode?: string
	additionalBarcodes?: string[]
	retailPrice: number
	purchasePrice?: number
	wholesalePrice?: number
	quantity: number
	categoryId?: string
	supplierId?: string
	unitId?: string
	categoryName?: string
	supplierName?: string
	unitName?: string
	errors: string[]
	warnings: string[]
	duplicate: boolean
}

const HEADER_HINTS: Record<ProductImportField, string[]> = {
	name: [
		'name',
		'product',
		'item',
		'artikel',
		'produkt',
		'اسم',
		'اسم المنتج',
		'اسم المادة',
		'اسم الصنف',
		'اسم السلعة',
		'المنتج',
		'المادة',
		'الصنف',
		'السلعة',
		'البيان',
	],
	barcode: [
		'barcode',
		'ean',
		'gtin',
		'upc',
		'باركود',
		'بار كود',
		'الباركود',
		'رمز شريطي',
	],
	category: [
		'category',
		'kategorie',
		'group',
		'الفئة',
		'فئة',
		'تصنيف',
		'مجموعة',
		'القسم',
	],
	supplier: ['supplier', 'vendor', 'lieferant', 'المورد', 'مورد', 'المزود'],
	quantity: [
		'qty',
		'quantity',
		'stock',
		'menge',
		'bestand',
		'الكمية',
		'كمية',
		'العدد',
		'الرصيد',
		'المخزون',
	],
	unit: ['unit', 'uom', 'einheit', 'وحدة', 'الوحدة', 'واحده'],
	purchasePrice: [
		'purchase',
		'buy',
		'cost',
		'einkauf',
		'ek',
		'سعر الشراء',
		'سعر التكلفة',
		'تكلفة',
		'شراء',
	],
	retailPrice: [
		'retail',
		'sell',
		'sale',
		'verkauf',
		'vk',
		'selling',
		'سعر البيع',
		'سعر المبيع',
		'سعر التجزئة',
		'السعر',
		'مبيع',
		'بيع',
	],
	wholesalePrice: [
		'wholesale',
		'großhandel',
		'سعر الجملة',
		'سعر جملة',
		'الجملة',
		'جملة',
	],
}

export const suggestHeaderMapping = (headers: string[]): HeaderMapping => {
	const unused = [...headers]
	const mapping: HeaderMapping = {}

	for (const field of PRODUCT_IMPORT_FIELDS) {
		const hints = HEADER_HINTS[field]
		const index = unused.findIndex(header => {
			const lower = header.toLowerCase()

			return hints.some(hint => lower.includes(hint))
		})

		if (index >= 0) {
			mapping[field] = unused[index]
			unused.splice(index, 1)
		}
	}

	return mapping
}

/** note: fixed symbol/token list; upgrade: tenant currency-settings labels. */
const IMPORT_CURRENCY_SYMBOLS = ['$', '€', '£', '¥', '₺'] as const
const IMPORT_CURRENCY_TOKENS = [
	'dollars',
	'dollar',
	'euros',
	'euro',
	'pounds',
	'pound',
	'usd',
	'eur',
	'gbp',
	'syp',
	'try',
	'aed',
	'sar',
	'egp',
	'jod',
	'iqd',
	'ل.س',
	'د.إ',
] as const

const stripImportCurrencyDecorators = (value: string): string => {
	let next = value.trim().replace(/\s+/g, ' ')

	for (const symbol of IMPORT_CURRENCY_SYMBOLS) {
		next = next.split(symbol).join('')
	}

	next = next.trim()

	for (const token of IMPORT_CURRENCY_TOKENS) {
		next = next
			.replace(new RegExp(`^${token}\\s*`, 'i'), '')
			.replace(new RegExp(`\\s*${token}$`, 'i'), '')
			.trim()
	}

	return next.replace(/\s/g, '')
}

/** Locale separators only — no currency junk left in `trimmed`. */
const normalizeImportNumberString = (trimmed: string): string | null => {
	if (!/^-?\d{1,3}([.,]\d{3})*([.,]\d+)?$|^-?\d+([.,]\d+)?$/.test(trimmed)) {
		return null
	}

	const lastComma = trimmed.lastIndexOf(',')
	const lastDot = trimmed.lastIndexOf('.')

	if (lastComma >= 0 && lastDot >= 0) {
		return lastComma > lastDot
			? trimmed.replace(/\./g, '').replace(',', '.')
			: trimmed.replace(/,/g, '')
	}

	if (lastComma >= 0) {
		// note: `1,500` → thousands (US/$ sheets). European `1,500` as 1.5 loses;
		// use `1,50` or `1.500,00`. Upgrade: per-file locale hint.
		if (/^-?\d{1,3}(,\d{3})+$/.test(trimmed)) {
			return trimmed.replace(/,/g, '')
		}

		return trimmed.replace(',', '.')
	}

	if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(trimmed)) {
		return trimmed.replace(/\./g, '')
	}

	return trimmed
}

export const parseImportNumber = (value: string): number | null => {
	const trimmed = stripImportCurrencyDecorators(value)

	if (!trimmed) return null

	const normalized = normalizeImportNumberString(trimmed)

	if (normalized == null) return null

	const parsed = Number(normalized)

	return Number.isFinite(parsed) ? parsed : null
}

const nonNegativeOrZero = (value: string): number => {
	const parsed = parseImportNumber(value)

	return parsed === null || parsed < 0 ? 0 : parsed
}

type ParsedImportPrice =
	| { ok: true; value: number | undefined }
	| { ok: false; error: string }

const parseRetailPrice = (raw: string): ParsedImportPrice => {
	if (!raw.trim()) return { ok: true, value: 0 }

	const parsed = parseImportNumber(raw)

	if (parsed === null || parsed < 0) {
		return { ok: false, error: `Invalid retail price: "${raw}".` }
	}

	return { ok: true, value: parsed }
}

const parseOptionalPrice = (raw: string, label: string): ParsedImportPrice => {
	if (!raw.trim()) return { ok: true, value: undefined }

	const parsed = parseImportNumber(raw)

	if (parsed === null || parsed < 0) {
		return { ok: false, error: `Invalid ${label}: "${raw}".` }
	}

	return { ok: true, value: parsed }
}

const cell = (
	row: SourceRow,
	mapping: HeaderMapping,
	field: ProductImportField,
): string => {
	const header = mapping[field]

	if (!header) return ''

	return row.values?.[header]?.trim() ?? ''
}

export const mappingIsComplete = (
	mapping: HeaderMapping,
	selectedFields?: ProductImportField[],
): boolean => {
	const required = selectedFields?.length
		? REQUIRED_PRODUCT_IMPORT_FIELDS.filter(field =>
				selectedFields.includes(field),
			)
		: REQUIRED_PRODUCT_IMPORT_FIELDS

	return required.every(field => Boolean(mapping[field]?.trim()))
}

const resolveMasterId = (
	resolutions: MasterResolutions | undefined,
	kind: 'category' | 'supplier' | 'unit',
	excelValue: string,
): string | undefined => {
	if (!excelValue.trim() || !resolutions?.[kind]) return undefined

	return resolutions[kind]?.[normalizeMasterName(excelValue)]
}

export const mapSourceRows = (
	rows: SourceRow[],
	mapping: HeaderMapping,
	resolutions?: MasterResolutions,
): MappedImportRow[] => {
	return rows.map(row => {
		const name = cell(row, mapping, 'name')
		const parsedBarcodes = parseImportBarcodeCell(
			'',
			cell(row, mapping, 'barcode') || undefined,
		)
		const barcode = parsedBarcodes.barcode
		const additionalBarcodes = parsedBarcodes.additionalBarcodes
		const retailRaw = cell(row, mapping, 'retailPrice')
		const purchaseRaw = cell(row, mapping, 'purchasePrice')
		const wholesaleRaw = cell(row, mapping, 'wholesalePrice')
		const quantityRaw = cell(row, mapping, 'quantity')
		const categoryName = cell(row, mapping, 'category') || undefined
		const supplierName = cell(row, mapping, 'supplier') || undefined
		const unitName = cell(row, mapping, 'unit') || undefined
		const errors: string[] = []
		const warnings: string[] = []

		if (!name) {
			errors.push('Product name is required.')
		} else if (name.length > 100) {
			errors.push('Product name cannot exceed 100 characters.')
		}

		if (parsedBarcodes.error) {
			errors.push(parsedBarcodes.error)
		}

		const retail = parseRetailPrice(retailRaw)
		const purchase = parseOptionalPrice(purchaseRaw, 'purchase price')
		const wholesale = parseOptionalPrice(wholesaleRaw, 'wholesale price')
		const quantity = nonNegativeOrZero(quantityRaw)

		if (!retail.ok) errors.push(retail.error)

		if (!purchase.ok) errors.push(purchase.error)

		if (!wholesale.ok) errors.push(wholesale.error)

		const categoryId = categoryName
			? resolveMasterId(resolutions, 'category', categoryName)
			: undefined
		const supplierId = supplierName
			? resolveMasterId(resolutions, 'supplier', supplierName)
			: undefined
		const unitId = unitName
			? resolveMasterId(resolutions, 'unit', unitName)
			: undefined

		// After confirm, missing resolution = user skipped → leave ID unset.
		// Before confirm (no resolutions object), unresolved mapped values error.
		if (resolutions === undefined) {
			if (categoryName && !categoryId) {
				errors.push(`Category "${categoryName}" is not resolved.`)
			}

			if (supplierName && !supplierId) {
				errors.push(`Supplier "${supplierName}" is not resolved.`)
			}

			if (unitName && !unitId) {
				errors.push(`Unit "${unitName}" is not resolved.`)
			}
		}

		return {
			fileName: row.fileName,
			rowNumber: row.rowNumber,
			fileIndex: row.fileIndex,
			name,
			barcode,
			additionalBarcodes,
			retailPrice: retail.ok ? (retail.value ?? 0) : 0,
			purchasePrice: purchase.ok ? purchase.value : undefined,
			wholesalePrice: wholesale.ok ? wholesale.value : undefined,
			quantity,
			categoryId,
			supplierId,
			unitId,
			categoryName,
			supplierName,
			unitName,
			errors,
			warnings,
			duplicate: false,
		}
	})
}

/** Mark row-vs-row and optional existing-tenant barcode collisions. */
export const applyImportBarcodeCollisions = (
	rows: MappedImportRow[],
	existingBarcodeKeys?: Set<string>,
): MappedImportRow[] => {
	const firstOwner = new Map<string, number>()

	return rows.map((row, index) => {
		const codes = allBarcodes({
			productId: '',
			barcode: row.barcode,
			additionalBarcodes: row.additionalBarcodes,
		})
		const errors = [...row.errors]

		for (const code of codes) {
			const key = barcodeCompareKey(code)
			const owner = firstOwner.get(key)

			if (owner !== undefined && owner !== index) {
				errors.push(`Barcode "${code}" is used by another row in this import.`)
			} else if (owner === undefined) {
				firstOwner.set(key, index)
			}

			if (existingBarcodeKeys?.has(key)) {
				errors.push(`Barcode "${code}" is already used by another product.`)
			}
		}

		return errors.length === row.errors.length ? row : { ...row, errors }
	})
}
