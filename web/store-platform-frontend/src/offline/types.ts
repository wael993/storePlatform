import type { CurrencySettings, InvoiceSettings } from '../api/apiStore'
import type { ApiBuyingInvoice } from '../components/BuyingInvoice/buyingInvoiceApiMappers'
import type { ApiSellingInvoice } from '../components/SellingInvoice/invoiceApiMappers'
import type {
	InventoryItem,
	ProductCatalogItem,
	UserSettings,
} from '../api/apiStore'

export type SyncStatus = 'synced' | 'pending' | 'conflict'

export type OutboxEntity =
	| 'invoice'
	| 'buyingInvoice'
	| 'product'
	| 'inventory'
	| 'customer'
	| 'supplier'
	| 'partner'
	| 'category'
	| 'brand'
	| 'shelf'
	| 'warehouse'
	| 'expense'
	| 'dailyAction'
	| 'currency'
	| 'unit'
	| 'userSettings'
	| 'currencySettings'
	| 'invoiceSettings'

export type OutboxOperation = 'create' | 'update' | 'delete'

export interface SyncMetaRecord {
	key: string
	value: string
}

export interface OutboxEntry {
	id: string
	entity: OutboxEntity
	operation: OutboxOperation
	url: string
	method: string
	payload: unknown
	clientMutationId: string
	createdAt: string
	retryCount: number
	lastError?: string
	status: 'pending' | 'processing' | 'failed' | 'completed'
}

export interface LocalRecordMeta {
	syncStatus: SyncStatus
	clientId?: string
	updatedAt: string
}

export interface LocalCatalogProduct extends ProductCatalogItem {
	tenantId: string
}

export type LocalProduct = Product & LocalRecordMeta
export type LocalCustomer = Customer & LocalRecordMeta
export type LocalSupplier = Supplier & LocalRecordMeta
export type LocalPartner = Partner & LocalRecordMeta
export type LocalCategory = Category & LocalRecordMeta
export type LocalBrand = Brand & LocalRecordMeta
export type LocalShelf = Shelf & LocalRecordMeta
export type LocalWarehouse = Warehouse & LocalRecordMeta
export type LocalExpense = Expense & LocalRecordMeta
export type LocalDailyAction = DailyAction & LocalRecordMeta
export type LocalCurrency = Currency & LocalRecordMeta
export type LocalUnit = Unit & LocalRecordMeta

export interface LocalInventoryItem extends InventoryItem, LocalRecordMeta {}

export interface LocalInvoice extends ApiSellingInvoice, LocalRecordMeta {
	invoiceId: string
}

export interface LocalBuyingInvoice extends ApiBuyingInvoice, LocalRecordMeta {
	buyingInvoiceId: string
}

export interface BootstrapPayload {
	products: Product[]
	inventory: InventoryItem[]
	customers: Customer[]
	suppliers: Supplier[]
	partners: Partner[]
	categories: Category[]
	brands: Brand[]
	shelves: Shelf[]
	warehouses: Warehouse[]
	currencies: Currency[]
	units: Unit[]
	expenses: Expense[]
	dailyActions: DailyAction[]
	invoices: ApiSellingInvoice[]
	buyingInvoices?: ApiBuyingInvoice[]
	currencySettings?: CurrencySettings
	invoiceSettings?: InvoiceSettings
	userSettings?: UserSettings
	frontendResources?: FrontendResources[]
	nextInvoiceNumber: number
	invoiceNumberBlockEnd: number
	nextBuyingInvoiceNumber?: number
	buyingInvoiceNumberBlockEnd?: number
	serverTime: string
	offlineRetentionDays?: number
}

export interface SyncChangesPayload {
	products?: Product[]
	inventory?: InventoryItem[]
	customers?: Customer[]
	suppliers?: Supplier[]
	partners?: Partner[]
	categories?: Category[]
	brands?: Brand[]
	shelves?: Shelf[]
	warehouses?: Warehouse[]
	currencies?: Currency[]
	units?: Unit[]
	expenses?: Expense[]
	dailyActions?: DailyAction[]
	invoices?: ApiSellingInvoice[]
	buyingInvoices?: ApiBuyingInvoice[]
	currencySettings?: CurrencySettings
	invoiceSettings?: InvoiceSettings
	userSettings?: UserSettings
	frontendResources?: FrontendResources[]
	serverTime: string
}

export interface SyncPushEntry {
	clientMutationId: string
	entity: OutboxEntity
	operation: OutboxOperation
	url: string
	method: string
	payload: unknown
}

export interface SyncPushResult {
	clientMutationId: string
	success: boolean
	error?: string
	data?: unknown
}

export interface SyncPushResponse {
	results: SyncPushResult[]
	serverTime: string
}

export type OfflineSyncState =
	'idle' | 'bootstrapping' | 'syncing' | 'offline' | 'error' | 'success'

export type SyncPushResultType = 'success' | 'partial' | 'failed'

export interface SyncPushResultInfo {
	type: SyncPushResultType
	syncedCount: number
	failedCount: number
	errorMessage?: string
}

export interface OfflineState {
	isOnline: boolean
	syncState: OfflineSyncState
	pendingCount: number
	lastSyncedAt: string | null
	lastError: string | null
	isOfflineCapable: boolean
	syncPushResult: SyncPushResultInfo | null
}
