import Dexie, { Table } from 'dexie'

import type {
	LocalCatalogProduct,
	LocalBrand,
	LocalCategory,
	LocalCurrency,
	LocalCustomer,
	LocalDailyAction,
	LocalExpense,
	LocalInventoryItem,
	LocalInvoice,
	LocalBuyingInvoice,
	LocalPartner,
	LocalProduct,
	LocalShelf,
	LocalSupplier,
	LocalUnit,
	LocalWarehouse,
	OutboxEntry,
	SyncMetaRecord,
} from './types'

export class StorePlatformOfflineDB extends Dexie {
	catalogProducts!: Table<LocalCatalogProduct, string>
	products!: Table<LocalProduct, string>
	inventory!: Table<LocalInventoryItem, string>
	customers!: Table<LocalCustomer, string>
	suppliers!: Table<LocalSupplier, string>
	partners!: Table<LocalPartner, string>
	categories!: Table<LocalCategory, string>
	brands!: Table<LocalBrand, string>
	shelves!: Table<LocalShelf, string>
	warehouses!: Table<LocalWarehouse, string>
	currencies!: Table<LocalCurrency, string>
	units!: Table<LocalUnit, string>
	expenses!: Table<LocalExpense, string>
	dailyActions!: Table<LocalDailyAction, string>
	invoices!: Table<LocalInvoice, string>
	buyingInvoices!: Table<LocalBuyingInvoice, string>
	syncMeta!: Table<SyncMetaRecord, string>
	outbox!: Table<OutboxEntry, string>

	constructor() {
		super('StorePlatformOfflineDB')

		this.version(1).stores({
			products: 'productId, barcode, name, syncStatus, updatedAt',
			inventory: 'inventoryId, productId, syncStatus, updatedAt',
			customers: 'customerId, name, syncStatus, updatedAt',
			suppliers: 'supplierId, name, syncStatus, updatedAt',
			partners: 'partnerId, name, syncStatus, updatedAt',
			categories: 'categoryId, name, syncStatus, updatedAt',
			brands: 'brandId, name, syncStatus, updatedAt',
			shelves: 'shelfId, name, syncStatus, updatedAt',
			warehouses: 'warehouseId, name, syncStatus, updatedAt',
			currencies: 'currencyId, name, syncStatus, updatedAt',
			units: 'unitId, name, syncStatus, updatedAt',
			expenses: 'expenseId, name, syncStatus, updatedAt',
			dailyActions: 'actionId, syncStatus, updatedAt',
			invoices: 'invoiceId, invoiceNumber, syncStatus, updatedAt',
			syncMeta: 'key',
			outbox: 'id, clientMutationId, status, createdAt, entity',
		})

		this.version(2).stores({
			products: 'productId, barcode, name, syncStatus, updatedAt',
			inventory: 'inventoryId, productId, syncStatus, updatedAt',
			customers: 'customerId, name, syncStatus, updatedAt',
			suppliers: 'supplierId, name, syncStatus, updatedAt',
			partners: 'partnerId, name, syncStatus, updatedAt',
			categories: 'categoryId, name, syncStatus, updatedAt',
			brands: 'brandId, name, syncStatus, updatedAt',
			shelves: 'shelfId, name, syncStatus, updatedAt',
			warehouses: 'warehouseId, name, syncStatus, updatedAt',
			currencies: 'currencyId, name, syncStatus, updatedAt',
			units: 'unitId, name, syncStatus, updatedAt',
			expenses: 'expenseId, name, syncStatus, updatedAt',
			dailyActions: 'actionId, invoiceDate, syncStatus, updatedAt',
			invoices: 'invoiceId, invoiceNumber, issuedAt, syncStatus, updatedAt',
			syncMeta: 'key',
			outbox: 'id, clientMutationId, status, createdAt, entity',
		})

		this.version(4).stores({
			catalogProducts: 'productId, tenantId, barcode, name',
			products: 'productId, barcode, name, syncStatus, updatedAt',
			inventory: 'inventoryId, productId, syncStatus, updatedAt',
			customers: 'customerId, name, syncStatus, updatedAt',
			suppliers: 'supplierId, name, syncStatus, updatedAt',
			partners: 'partnerId, name, syncStatus, updatedAt',
			categories: 'categoryId, name, syncStatus, updatedAt',
			brands: 'brandId, name, syncStatus, updatedAt',
			shelves: 'shelfId, name, syncStatus, updatedAt',
			warehouses: 'warehouseId, name, syncStatus, updatedAt',
			currencies: 'currencyId, name, syncStatus, updatedAt',
			units: 'unitId, name, syncStatus, updatedAt',
			expenses: 'expenseId, name, syncStatus, updatedAt',
			dailyActions: 'actionId, invoiceDate, syncStatus, updatedAt',
			invoices: 'invoiceId, invoiceNumber, issuedAt, syncStatus, updatedAt',
			buyingInvoices:
				'buyingInvoiceId, invoiceNumber, issuedAt, syncStatus, updatedAt',
			syncMeta: 'key',
			outbox: 'id, clientMutationId, status, createdAt, entity',
		})
	}
}

export const offlineDb = new StorePlatformOfflineDB()

export const SYNC_META_KEYS = {
	lastSyncedAt: 'lastSyncedAt',
	nextInvoiceNumber: 'nextInvoiceNumber',
	nextBuyingInvoiceNumber: 'nextBuyingInvoiceNumber',
	buyingInvoiceNumberBlockEnd: 'buyingInvoiceNumberBlockEnd',
	invoiceNumberBlockEnd: 'invoiceNumberBlockEnd',
	isOfflineCapable: 'isOfflineCapable',
	tenantId: 'tenantId',
	sessionTenantId: 'sessionTenantId',
	tenantOfflineEnabled: 'tenantOfflineEnabled',
	frontendResources: 'frontendResources',
	currencySettings: 'currencySettings',
	invoiceSettings: 'invoiceSettings',
	offlineRetentionDays: 'offlineRetentionDays',
	workMode: 'workMode',
	workModePreference: 'workModePreference',
	catalogLastSyncedAt: 'catalogLastSyncedAt',
	productNotifications: 'productNotifications',
	productNotificationDigest: 'productNotificationDigest',
} as const

export const getSyncMeta = async (key: string): Promise<string | null> => {
	const record = await offlineDb.syncMeta.get(key)
	return record?.value ?? null
}

export const setSyncMeta = async (
	key: string,
	value: string,
): Promise<void> => {
	await offlineDb.syncMeta.put({ key, value })
}

export const getPendingOutboxCount = async (): Promise<number> =>
	offlineDb.outbox.where('status').anyOf(['pending', 'failed']).count()

export const getProcessingOutboxCount = async (): Promise<number> =>
	offlineDb.outbox.where('status').equals('processing').count()
