import type { ClientSession, Model } from 'mongoose'

import type { DbTx } from '.'

/**
 * Which store owns each collection during the migration (one owner at a time,
 * ADR "port by transaction group"). Group 1 = money + stock; group 2 = catalog, parties,
 * master data; group 3 = settings, reports, notifications, import drafts;
 * group 4 = platform (tenants, users, tokens, subscriptions, newsroom).
 * shortcut: grows with each group; deleted with Mongo in PG-MIG-6.
 */
const PG_MODELS = new Set([
	'Invoice',
	'SellingInvoiceItem', // legacy invoices, read-only
	'BuyingInvoice',
	'Inventory',
	'StockMovings',
	'CashAccount',
	'CashLedgerEntry',
	'DailyAction',
	'SyncMutation',
	'OfflineSyncState',
	// group 2: catalog, parties, master data
	'Products',
	'Category',
	'Brand',
	'Unit',
	'Shelf',
	'Warehouses',
	'Currency',
	'CurrencySettings',
	'Customer',
	'Supplier',
	'Partner',
	'Project',
	'Employee',
	'Expense',
	// group 3: settings, reports, notifications, import drafts
	'InvoiceSettings',
	'LabelTemplate',
	'UserSettings',
	'TenantRolePermission',
	'Report',
	'NegativeQuantitySnapshot',
	'NotificationRead',
	'ProductImportSession',
	// group 4: platform
	'Tenant',
	'User',
	'RefreshToken',
	'SubscriptionRenewalRequest',
	'SubscriptionPaymentSettings',
	'NewsroomTopic',
	'NewsroomReleaseNote',
	'NewsroomChange',
	'NewsroomUserState',
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isPgModel = (model: Model<any>) => PG_MODELS.has(model.modelName)

/** What generic helpers accept while both stores exist. */
export type Session = ClientSession | DbTx

export const asTx = (session?: Session): DbTx | undefined =>
	session && 'execute' in session ? session : undefined

export const asMongoSession = (session?: Session): ClientSession | undefined =>
	session && !('execute' in session) ? session : undefined
