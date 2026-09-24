export const PRODUCT_IMPORT_STATUS = {
	NOT_STARTED: 'NOT_STARTED',
	IN_PROGRESS: 'IN_PROGRESS',
	SKIPPED: 'SKIPPED',
	COMPLETED: 'COMPLETED',
} as const

export type ProductImportStatus =
	(typeof PRODUCT_IMPORT_STATUS)[keyof typeof PRODUCT_IMPORT_STATUS]

export type ProductImportFieldKey =
	| 'name'
	| 'barcode'
	| 'category'
	| 'supplier'
	| 'quantity'
	| 'unit'
	| 'purchasePrice'
	| 'retailPrice'
	| 'wholesalePrice'

export const PRODUCT_IMPORT_FIELD_KEYS: ProductImportFieldKey[] = [
	'name',
	'barcode',
	'category',
	'supplier',
	'quantity',
	'unit',
	'purchasePrice',
	'retailPrice',
	'wholesalePrice',
]

export const REQUIRED_PRODUCT_IMPORT_FIELDS: ProductImportFieldKey[] = [
	'name',
	'retailPrice',
]

export const MASTER_DATA_IMPORT_FIELDS = [
	'category',
	'supplier',
	'unit',
] as const

export type MasterDataImportField = (typeof MASTER_DATA_IMPORT_FIELDS)[number]

export const PRODUCT_IMPORT_FIELD_LABEL_KEYS: Record<
	ProductImportFieldKey,
	string
> = {
	name: 'common.productName',
	barcode: 'common.barcode',
	category: 'common.category',
	supplier: 'common.supplier',
	quantity: 'common.stockQuantity',
	unit: 'productModal.unitId',
	purchasePrice: 'productModal.purchasePrice',
	retailPrice: 'productModal.retailPrice',
	wholesalePrice: 'productModal.wholesalePrice',
}

export type ProductImportStatusResponse = {
	status: ProductImportStatus
	productCount: number
	fields: Array<{ key: ProductImportFieldKey; required: boolean }>
	resume?: ProductImportParseResponse
}

export type ProductImportMapping = Partial<
	Record<ProductImportFieldKey, string | null>
>

export type ProductImportParseResponse = {
	sessionId: string
	currency?: string
	selectedFields?: ProductImportFieldKey[]
	files: Array<{ fileName: string; headers: string[]; rowCount: number }>
	headers: string[]
	suggestedMapping: ProductImportMapping
	aiSuggestedFields: string[]
}

export type MasterDataProposal = {
	kind: MasterDataImportField
	excelValue: string
	normalized: string
	status: 'match' | 'create' | 'ambiguous'
	matchedId?: string
	matchedName?: string
	candidates: Array<{ id: string; name: string }>
}

export type MasterDataDecision = {
	kind: MasterDataImportField
	excelValue: string
	action: 'match' | 'create' | 'skip'
	matchedId?: string
	/** Name used when action is create; defaults to excelValue. */
	createName?: string
}

export type ProductImportMasterPrepareResponse = {
	sessionId: string
	proposals: MasterDataProposal[]
}

export type ProductImportPreviewResponse = {
	sessionId: string
	currency?: string
	fileCount: number
	detected: number
	valid: number
	duplicates: number
	invalid: number
	preview: Array<{
		name: string
		barcode?: string
		category?: string
		supplier?: string
		unit?: string
		purchasePrice?: number
		retailPrice: number
		wholesalePrice?: number
		quantity: number
	}>
	errors: Array<{ fileName: string; rowNumber: number; errors: string[] }>
	warnings: Array<{ fileName: string; rowNumber: number; warnings: string[] }>
}

export type ProductImportCommitResponse = {
	imported: number
	processed: number
	total: number
	done: boolean
	duplicates: number
	invalid: number
	errors: Array<{ fileName: string; rowNumber: number; errors: string[] }>
}

export const PRODUCT_IMPORT_COMMIT_BATCH_SIZE = 100

export const isExcelImportFileName = (fileName: string) =>
	/\.(xlsx|xlsm)$/i.test(fileName)

export const productImportLaterKey = (tenantId: string) =>
	`productImportLater:${tenantId}`
