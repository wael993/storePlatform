import {
	PRODUCT_IMPORT_FIELDS,
	REQUIRED_PRODUCT_IMPORT_FIELDS,
	type ProductImportField,
} from '../constants/productImport'

export type HeaderMapping = Partial<Record<ProductImportField, string | null>>

export type SourceRow = {
	fileName: string
	rowNumber: number
	fileIndex?: number
	values: Record<string, string>
}

export type CatalogMatch = {
	categoryId?: string
	supplierId?: string
	warning?: string
}

export type MappedImportRow = {
	fileName: string
	rowNumber: number
	fileIndex?: number
	name: string
	latinName?: string
	internalCode?: string
	productFactoryCode?: string
	barcode?: string
	retailPrice: number
	purchasePrice?: number
	wholesalePrice?: number
	quantity: number
	description?: string
	categoryId?: string
	supplierId?: string
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
		'description',
		'اسم',
		'اسم المنتج',
		'اسم المادة',
		'اسم الصنف',
		'اسم السلعة',
		'المنتج',
		'المنتجات',
		'المادة',
		'المواد',
		'الصنف',
		'الأصناف',
		'السلعة',
		'السلع',
		'البيان',
		'بيان',
		'وصف المنتج',
		'وصف الصنف',
		'الوصف',
	],
	latinName: [
		'latin',
		'الاسم اللاتيني',
		'الاسم باللاتينية',
		'الاسم الانكليزي',
		'الاسم الإنجليزي',
		'الاسم الاجنبي',
		'الاسم الأجنبي',
	],
	internalCode: [
		'internal',
		'sku',
		'article number',
		'artikelnummer',
		'الكود',
		'كود',
		'كود داخلي',
		'الكود الداخلي',
		'رمز',
		'رمز المنتج',
		'رمز الصنف',
		'رمز المادة',
		'رقم المادة',
		'رقم الصنف',
		'رقم المنتج',
		'رقم السلعة',
		'كود الصنف',
		'كود المادة',
		'كود المنتج',
		'الرقم الداخلي',
		'الرمز الداخلي',
	],
	productFactoryCode: [
		'factory',
		'manufacturer',
		'كود المصنع',
		'رمز المصنع',
		'رقم المصنع',
		'كود الشركة المصنعة',
		'رمز الشركة المصنعة',
		'رقم الشركة المصنعة',
		'كود المنتج من المصنع',
		'رقم المنتج من المصنع',
		'رقم الموديل',
		'رمز الموديل',
	],
	barcode: [
		'barcode',
		'ean',
		'gtin',
		'upc',
		'باركود',
		'باركود',
		'بار كود',
		'الباركود',
		'رمز شريطي',
		'الرمز الشريطي',
		'الرمز الشريطي للمنتج',
		'رقم الباركود',
		'كود الباركود',
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
		'سعر المبيع للمستهلك',
		'سعر المستهلك',
		'سعر التجزئة',
		'سعر البيع بالتجزئة',
		'سعر التجزئة للمستهلك',
		'سعر السوق',
		'سعر البيع النهائي',
		'السعر',
		'سعر الوحدة',
		'سعر بيع الوحدة',
		'ثمن البيع',
		'قيمة البيع',
		'مبيع',
		'بيع',
	],
	purchasePrice: [
		'purchase',
		'buy',
		'cost',
		'einkauf',
		'ek',
		'سعر الشراء',
		'سعر شراء',
		'سعر التكلفة',
		'سعر التكلفه',
		'تكلفة الشراء',
		'تكلفة المنتج',
		'تكلفة الصنف',
		'تكلفة المادة',
		'تكلفة الوحدة',
		'سعر التكلفة للوحدة',
		'سعر التوريد',
		'سعر التوريد للوحدة',
		'سعر المورد',
		'سعر الشراء من المورد',
		'ثمن الشراء',
		'قيمة الشراء',
		'شراء',
		'تكلفة',
	],
	wholesalePrice: [
		'wholesale',
		'großhandel',
		'سعر الجملة',
		'سعر جملة',
		'سعر البيع بالجملة',
		'سعر الجملة للموزع',
		'سعر الموزع',
		'سعر التوزيع',
		'الجملة',
		'جملة',
	],
	quantity: [
		'qty',
		'quantity',
		'stock',
		'menge',
		'bestand',
		'الكمية',
		'كمية',
		'كمية المنتج',
		'كمية الصنف',
		'كمية المادة',
		'العدد',
		'عدد',
		'عدد القطع',
		'عدد الوحدات',
		'الوحدات',
		'الرصيد',
		'رصيد',
		'رصيد المخزون',
		'المخزون',
		'كمية المخزون',
		'مخزون',
		'رصيد المستودع',
		'رصيد المخزن',
		'المتاح',
		'الكمية المتاحة',
	],
	description: [
		'note',
		'notes',
		'desc',
		'الوصف',
		'وصف',
		'وصف المنتج',
		'وصف الصنف',
		'وصف المادة',
		'الملاحظات',
		'ملاحظات',
		'ملاحظة',
		'ملاحظه',
		'التفاصيل',
		'تفاصيل',
		'بيان',
		'بيانات',
		'تعليق',
		'تعليقات',
		'ملاحظات إضافية',
		'ملاحظات اضافية',
	],
	category: [
		'category',
		'kategorie',
		'group',
		'الفئة',
		'فئة',
		'الفئات',
		'تصنيف',
		'التصنيف',
		'التصنيفات',
		'مجموعة',
		'المجموعة',
		'مجموعات',
		'مجموعة المنتجات',
		'مجموعة الأصناف',
		'مجموعة الاصناف',
		'مجموعة المواد',
		'فئة المنتج',
		'تصنيف المنتج',
		'نوع المنتج',
		'نوع الصنف',
		'نوع المادة',
		'القسم',
		'قسم',
	],
	supplier: [
		'supplier',
		'vendor',
		'lieferant',
		'المورد',
		'مورد',
		'الموردين',
		'الموردون',
		'اسم المورد',
		'شركة المورد',
		'الشركة الموردة',
		'الجهة الموردة',
		'المزود',
		'مزود',
		'اسم المزود',
		'البائع',
		'البائع الرئيسي',
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

export const parseImportNumber = (value: string): number | null => {
	const trimmed = value.trim().replace(/\s/g, '')

	if (!trimmed) return null

	const lastComma = trimmed.lastIndexOf(',')
	const lastDot = trimmed.lastIndexOf('.')
	const normalized =
		lastComma > lastDot
			? trimmed.replace(/\./g, '').replace(',', '.')
			: trimmed.replace(/,/g, '')
	const parsed = Number(normalized)

	return Number.isFinite(parsed) ? parsed : null
}

const nonNegativeOrZero = (value: string): number => {
	const parsed = parseImportNumber(value)

	return parsed === null || parsed < 0 ? 0 : parsed
}

const optionalNonNegative = (value: string): number | undefined => {
	if (!value.trim()) return undefined

	const parsed = parseImportNumber(value)

	return parsed === null || parsed < 0 ? 0 : parsed
}

const cell = (
	row: SourceRow,
	mapping: HeaderMapping,
	field: ProductImportField,
): string => {
	const header = mapping[field]

	if (!header) return ''

	return row.values[header]?.trim() ?? ''
}

export const mappingIsComplete = (mapping: HeaderMapping): boolean =>
	REQUIRED_PRODUCT_IMPORT_FIELDS.every(field => Boolean(mapping[field]?.trim()))

export const mapSourceRows = (
	rows: SourceRow[],
	mapping: HeaderMapping,
	existingBarcodes: Set<string>,
	matchCatalog: (kind: 'category' | 'supplier', name: string) => CatalogMatch,
): MappedImportRow[] => {
	const seenBarcodes = new Set<string>()

	return rows.map(row => {
		const name = cell(row, mapping, 'name')
		const latinName = cell(row, mapping, 'latinName') || undefined
		const barcode = cell(row, mapping, 'barcode') || undefined
		const retailRaw = cell(row, mapping, 'retailPrice')
		const purchaseRaw = cell(row, mapping, 'purchasePrice')
		const wholesaleRaw = cell(row, mapping, 'wholesalePrice')
		const quantityRaw = cell(row, mapping, 'quantity')
		const categoryName = cell(row, mapping, 'category')
		const supplierName = cell(row, mapping, 'supplier')
		const description = cell(row, mapping, 'description') || undefined
		const errors: string[] = []
		const warnings: string[] = []
		const resolvedName = name || latinName || ''

		if (!resolvedName) {
			errors.push('Product name is required.')
		} else if (resolvedName.length > 100) {
			errors.push('Product name cannot exceed 100 characters.')
		}

		if (latinName && latinName.length > 100) {
			errors.push('Latin name cannot exceed 100 characters.')
		}

		if (description && description.length > 500) {
			errors.push('Description cannot exceed 500 characters.')
		}

		const retailPrice = nonNegativeOrZero(retailRaw)
		const quantity = nonNegativeOrZero(quantityRaw)
		const purchasePrice = optionalNonNegative(purchaseRaw)
		const wholesalePrice = optionalNonNegative(wholesaleRaw)

		let duplicate = false

		if (barcode) {
			if (existingBarcodes.has(barcode) || seenBarcodes.has(barcode)) {
				duplicate = true
				errors.push('Product barcode already exists.')
			}

			seenBarcodes.add(barcode)
		}

		let categoryId: string | undefined
		let supplierId: string | undefined

		if (categoryName) {
			const match = matchCatalog('category', categoryName)

			categoryId = match.categoryId

			if (match.warning) warnings.push(match.warning)
		}

		if (supplierName) {
			const match = matchCatalog('supplier', supplierName)

			supplierId = match.supplierId

			if (match.warning) warnings.push(match.warning)
		}

		return {
			fileName: row.fileName,
			rowNumber: row.rowNumber,
			fileIndex: row.fileIndex,
			name: resolvedName,
			latinName,
			internalCode: cell(row, mapping, 'internalCode') || undefined,
			productFactoryCode: cell(row, mapping, 'productFactoryCode') || undefined,
			barcode,
			retailPrice,
			purchasePrice,
			wholesalePrice,
			quantity,
			description,
			categoryId,
			supplierId,
			errors,
			warnings,
			duplicate,
		}
	})
}
