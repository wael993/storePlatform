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
	| 'latinName'
	| 'internalCode'
	| 'productFactoryCode'
	| 'barcode'
	| 'retailPrice'
	| 'purchasePrice'
	| 'wholesalePrice'
	| 'quantity'
	| 'description'
	| 'category'
	| 'supplier'

export const PRODUCT_IMPORT_FIELD_LABEL_KEYS: Record<
	ProductImportFieldKey,
	string
> = {
	name: 'common.productName',
	latinName: 'productModal.latinName',
	internalCode: 'productModal.internalCode',
	productFactoryCode: 'productModal.productFactoryCode',
	barcode: 'common.barcode',
	retailPrice: 'productModal.retailPrice',
	purchasePrice: 'productModal.purchasePrice',
	wholesalePrice: 'productModal.wholesalePrice',
	quantity: 'common.stockQuantity',
	description: 'productModal.description',
	category: 'common.category',
	supplier: 'common.supplier',
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
	files: Array<{ fileName: string; headers: string[]; rowCount: number }>
	headers: string[]
	suggestedMapping: ProductImportMapping
	aiSuggestedFields: string[]
}

export type ProductImportPreviewResponse = {
	sessionId: string
	fileCount: number
	detected: number
	valid: number
	duplicates: number
	invalid: number
	preview: Array<{
		name: string
		internalCode?: string
		barcode?: string
		purchasePrice?: number
		retailPrice: number
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

export const PRODUCT_IMPORT_COMMIT_BATCH_SIZE = 25

export const isExcelImportFileName = (fileName: string) =>
	/\.(xlsx|xlsm)$/i.test(fileName)

export const productImportLaterKey = (tenantId: string) =>
	`productImportLater:${tenantId}`
