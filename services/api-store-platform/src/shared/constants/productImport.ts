export const PRODUCT_IMPORT_STATUS = {
	NOT_STARTED: 'NOT_STARTED',
	IN_PROGRESS: 'IN_PROGRESS',
	SKIPPED: 'SKIPPED',
	COMPLETED: 'COMPLETED',
} as const

export type ProductImportStatus =
	(typeof PRODUCT_IMPORT_STATUS)[keyof typeof PRODUCT_IMPORT_STATUS]

export const PRODUCT_IMPORT_FIELDS = [
	'name',
	'latinName',
	'internalCode',
	'productFactoryCode',
	'barcode',
	'retailPrice',
	'purchasePrice',
	'wholesalePrice',
	'quantity',
	'description',
	'category',
	'supplier',
] as const

export type ProductImportField = (typeof PRODUCT_IMPORT_FIELDS)[number]

export const isProductImportField = (
	value: string,
): value is ProductImportField =>
	PRODUCT_IMPORT_FIELDS.some(field => field === value)

export const REQUIRED_PRODUCT_IMPORT_FIELDS: ProductImportField[] = [
	'name',
	'retailPrice',
]

export const PRODUCT_IMPORT_LIMITS = {
	maxFiles: 5,
	maxFileBytes: 8 * 1024 * 1024,
	maxRows: 10_000,
	sessionTtlMs: 24 * 60 * 60 * 1000,
	previewRows: 50,
	commitBatchSize: 25,
	maxCommitBatchSize: 200,
} as const
