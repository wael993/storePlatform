import { loadTenantOfflineConfig } from './offlineTenantAccess'
import {
	OFFLINE_SYNC_RETENTION_DAYS,
	pruneExpiredOfflineRecords,
} from './offlineRetention'
import type { Table } from 'dexie'
import type {
	BootstrapPayload,
	LocalBuyingInvoice,
	LocalInventoryItem,
	LocalInvoice,
	OutboxEntity,
	OutboxOperation,
	SyncChangesPayload,
} from './types'
import {
	getPendingOutboxCount,
	getProcessingOutboxCount,
	getSyncMeta,
	offlineDb,
	setSyncMeta,
	SYNC_META_KEYS,
} from './db'
import {
	generateId,
	nowIso,
	withLocalMeta,
	normalizeBootstrapRecords,
} from './utils'
import { InvoiceStatus } from '../shared/globalEnums'
import {
	availableQuantityFromStock,
	mergeInvoiceItemsPreservingUnitCost,
} from 'store-domain'

const INVOICE_NUMBER_BLOCK_SIZE = 500

const putBootstrapRecords = async <T>(
	table: Table<T, string>,
	entityLabel: string,
	records: unknown[] | undefined,
	idField: string,
	fallbacks: string[] = ['_id'],
): Promise<void> => {
	const normalized = normalizeBootstrapRecords(records, idField, fallbacks).map(
		record => withLocalMeta(record, 'synced') as T,
	)

	try {
		await table.bulkPut(normalized)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		throw new Error(`Failed to store ${entityLabel}: ${message}`)
	}
}

export const getLocalNextInvoiceNumber = async (): Promise<number> => {
	const current = Number(await getSyncMeta(SYNC_META_KEYS.nextInvoiceNumber))
	return Number.isFinite(current) && current > 0 ? current : 1
}

export const getLocalNextBuyingInvoiceNumber = async (): Promise<number> => {
	const current = Number(
		await getSyncMeta(SYNC_META_KEYS.nextBuyingInvoiceNumber),
	)
	return Number.isFinite(current) && current > 0 ? current : 1
}

/** Identity for create retries; PATCH/PUT also fingerprints the body so sequential updates are not collapsed. */
export const outboxIdempotencyKey = (
	url: string,
	method: string,
	payload: Record<string, unknown>,
): string => {
	const normalizedMethod = method.toUpperCase()
	const identity = [
		url,
		normalizedMethod,
		payload.invoiceId,
		payload.actionId,
		payload.productId,
		payload.customerId,
		payload.supplierId,
		payload.partnerId,
		payload.expenseId,
		payload.categoryId,
		payload.brandId,
		payload.shelfId,
		payload.warehouseId,
		payload.currencyId,
		payload.unitId,
	]
		.filter(Boolean)
		.join(':')

	if (normalizedMethod !== 'PATCH' && normalizedMethod !== 'PUT') {
		return identity
	}

	return `${identity}:${JSON.stringify(payload)}`
}

export const findDuplicateOutboxEntry = async (
	url: string,
	method: string,
	payload: Record<string, unknown>,
) => {
	const idempotencyKey = outboxIdempotencyKey(url, method, payload)

	if (!idempotencyKey) return null

	const candidates = await offlineDb.outbox
		.where('status')
		.anyOf(['pending', 'processing', 'failed'])
		.toArray()

	return (
		candidates.find(entry => {
			if (entry.url !== url || entry.method !== method) return false
			const entryPayload = (entry.payload ?? {}) as Record<string, unknown>
			return (
				outboxIdempotencyKey(entry.url, entry.method, entryPayload) ===
				idempotencyKey
			)
		}) ?? null
	)
}

export const hasPendingProductOrInventoryOutbox =
	async (): Promise<boolean> => {
		const pending = await offlineDb.outbox
			.where('status')
			.anyOf(['pending', 'processing', 'failed'])
			.toArray()

		return pending.some(
			entry => entry.entity === 'product' || entry.entity === 'inventory',
		)
	}

export const allocateNextInvoiceNumber = async (): Promise<number> => {
	const current = Number(await getSyncMeta(SYNC_META_KEYS.nextInvoiceNumber))
	const blockEnd = Number(
		await getSyncMeta(SYNC_META_KEYS.invoiceNumberBlockEnd),
	)

	if (!current || Number.isNaN(current)) {
		return 1
	}

	if (current > blockEnd) {
		throw new Error('Invoice number block exhausted. Please sync online.')
	}

	const next = current + 1
	await setSyncMeta(SYNC_META_KEYS.nextInvoiceNumber, String(next))
	return current
}

export const allocateNextBuyingInvoiceNumber = async (): Promise<number> => {
	const current = Number(
		await getSyncMeta(SYNC_META_KEYS.nextBuyingInvoiceNumber),
	)
	const blockEnd = Number(
		await getSyncMeta(SYNC_META_KEYS.buyingInvoiceNumberBlockEnd),
	)

	if (!current || Number.isNaN(current)) {
		return 1
	}

	if (current > blockEnd) {
		throw new Error('Buying invoice numbers exhausted. Please sync online.')
	}

	const next = current + 1
	await setSyncMeta(SYNC_META_KEYS.nextBuyingInvoiceNumber, String(next))
	return current
}

export const applyBootstrapPayload = async (
	payload: BootstrapPayload,
	tenantId: string,
): Promise<void> => {
	const pendingCount = await getPendingOutboxCount()
	const processingCount = await getProcessingOutboxCount()

	if (pendingCount > 0 || processingCount > 0) {
		throw new Error(
			'Cannot bootstrap while unsynced changes are pending. Please sync first.',
		)
	}

	await offlineDb.transaction(
		'rw',
		[
			offlineDb.products,
			offlineDb.inventory,
			offlineDb.customers,
			offlineDb.suppliers,
			offlineDb.partners,
			offlineDb.categories,
			offlineDb.brands,
			offlineDb.shelves,
			offlineDb.warehouses,
			offlineDb.currencies,
			offlineDb.units,
			offlineDb.expenses,
			offlineDb.dailyActions,
			offlineDb.invoices,
			offlineDb.buyingInvoices,
			offlineDb.catalogProducts,
			offlineDb.syncMeta,
			offlineDb.outbox,
		],
		async () => {
			await offlineDb.products.clear()
			await offlineDb.inventory.clear()
			await offlineDb.customers.clear()
			await offlineDb.suppliers.clear()
			await offlineDb.partners.clear()
			await offlineDb.categories.clear()
			await offlineDb.brands.clear()
			await offlineDb.shelves.clear()
			await offlineDb.warehouses.clear()
			await offlineDb.currencies.clear()
			await offlineDb.units.clear()
			await offlineDb.expenses.clear()
			await offlineDb.dailyActions.clear()
			await offlineDb.invoices.clear()
			await offlineDb.buyingInvoices.clear()
			await offlineDb.catalogProducts.clear()
			await offlineDb.outbox.clear()

			await putBootstrapRecords(
				offlineDb.products,
				'products',
				payload.products,
				'productId',
			)
			await putBootstrapRecords(
				offlineDb.inventory,
				'inventory',
				payload.inventory,
				'inventoryId',
				['productId'],
			)
			await putBootstrapRecords(
				offlineDb.customers,
				'customers',
				payload.customers,
				'customerId',
			)
			await putBootstrapRecords(
				offlineDb.suppliers,
				'suppliers',
				payload.suppliers,
				'supplierId',
			)
			await putBootstrapRecords(
				offlineDb.partners,
				'partners',
				payload.partners,
				'partnerId',
			)
			await putBootstrapRecords(
				offlineDb.categories,
				'categories',
				payload.categories,
				'categoryId',
			)
			await putBootstrapRecords(
				offlineDb.brands,
				'brands',
				payload.brands,
				'brandId',
			)
			await putBootstrapRecords(
				offlineDb.shelves,
				'shelves',
				payload.shelves,
				'shelfId',
			)
			await putBootstrapRecords(
				offlineDb.warehouses,
				'warehouses',
				payload.warehouses,
				'warehouseId',
			)
			await putBootstrapRecords(
				offlineDb.currencies,
				'currencies',
				payload.currencies,
				'currencyId',
			)
			await putBootstrapRecords(
				offlineDb.units,
				'units',
				payload.units,
				'unitId',
			)
			await putBootstrapRecords(
				offlineDb.expenses,
				'expenses',
				payload.expenses,
				'expenseId',
			)
			await putBootstrapRecords(
				offlineDb.dailyActions,
				'daily actions',
				payload.dailyActions,
				'actionId',
			)
			await putBootstrapRecords(
				offlineDb.invoices,
				'invoices',
				payload.invoices,
				'invoiceId',
			)
			await putBootstrapRecords(
				offlineDb.buyingInvoices,
				'buying invoices',
				payload.buyingInvoices,
				'buyingInvoiceId',
			)

			await setSyncMeta(SYNC_META_KEYS.lastSyncedAt, payload.serverTime)
			await setSyncMeta(
				SYNC_META_KEYS.nextInvoiceNumber,
				String(payload.nextInvoiceNumber),
			)
			await setSyncMeta(
				SYNC_META_KEYS.invoiceNumberBlockEnd,
				String(payload.invoiceNumberBlockEnd),
			)
			if (payload.nextBuyingInvoiceNumber !== undefined) {
				await setSyncMeta(
					SYNC_META_KEYS.nextBuyingInvoiceNumber,
					String(payload.nextBuyingInvoiceNumber),
				)
			}
			if (payload.buyingInvoiceNumberBlockEnd !== undefined) {
				await setSyncMeta(
					SYNC_META_KEYS.buyingInvoiceNumberBlockEnd,
					String(payload.buyingInvoiceNumberBlockEnd),
				)
			}
			await setSyncMeta(SYNC_META_KEYS.isOfflineCapable, 'true')
			await setSyncMeta(SYNC_META_KEYS.tenantId, tenantId)

			if (payload.userSettings) {
				await setSyncMeta('userSettings', JSON.stringify(payload.userSettings))
			}

			if (payload.currencySettings) {
				await setSyncMeta(
					SYNC_META_KEYS.currencySettings,
					JSON.stringify(payload.currencySettings),
				)
			}

			if (payload.invoiceSettings) {
				await setSyncMeta(
					SYNC_META_KEYS.invoiceSettings,
					JSON.stringify(payload.invoiceSettings),
				)
			}

			if (payload.frontendResources?.length) {
				await setSyncMeta(
					SYNC_META_KEYS.frontendResources,
					JSON.stringify(payload.frontendResources),
				)
			}

			await setSyncMeta(
				SYNC_META_KEYS.offlineRetentionDays,
				String(payload.offlineRetentionDays ?? OFFLINE_SYNC_RETENTION_DAYS),
			)
		},
	)

	await pruneExpiredOfflineRecords(
		payload.offlineRetentionDays ?? OFFLINE_SYNC_RETENTION_DAYS,
	)
}

export const cacheFrontendResources = async (
	resources: FrontendResources[],
): Promise<void> => {
	if (!resources.length) return
	await setSyncMeta(SYNC_META_KEYS.frontendResources, JSON.stringify(resources))
}

export const applySyncChanges = async (
	payload: SyncChangesPayload,
): Promise<void> => {
	const upsertIfNotPending = async <
		T extends { syncStatus?: string; updatedAt?: string },
	>(
		table: {
			get: (key: string) => Promise<T | undefined>
			put: (item: T) => Promise<unknown>
		},
		items: T[] | undefined,
		getKey: (item: T) => string | undefined,
	) => {
		if (!items?.length) return

		for (const item of items) {
			const key = getKey(item)
			if (!key) continue

			const existing = await table.get(key)
			if (existing?.syncStatus === 'pending') continue

			await table.put(
				withLocalMeta(item as T & Record<string, unknown>, 'synced'),
			)
		}
	}

	await upsertIfNotPending(
		offlineDb.products,
		payload.products?.map(p => withLocalMeta(p, 'synced')),
		item => (item as Product).productId,
	)
	await upsertIfNotPending(
		offlineDb.inventory,
		payload.inventory?.map(i => withLocalMeta(i, 'synced')),
		item =>
			(item as { inventoryId?: string; productId?: string }).inventoryId ??
			(item as { inventoryId?: string; productId?: string }).productId,
	)
	await upsertIfNotPending(
		offlineDb.customers,
		payload.customers?.map(c => withLocalMeta(c, 'synced')),
		item => (item as Customer).customerId,
	)
	await upsertIfNotPending(
		offlineDb.suppliers,
		payload.suppliers?.map(s => withLocalMeta(s, 'synced')),
		item => (item as Supplier).supplierId,
	)
	await upsertIfNotPending(
		offlineDb.partners,
		payload.partners?.map(p => withLocalMeta(p, 'synced')),
		item => (item as Partner).partnerId,
	)
	await upsertIfNotPending(
		offlineDb.categories,
		payload.categories?.map(c => withLocalMeta(c, 'synced')),
		item => (item as Category).categoryId,
	)
	await upsertIfNotPending(
		offlineDb.brands,
		payload.brands?.map(b => withLocalMeta(b, 'synced')),
		item => (item as Brand).brandId,
	)
	await upsertIfNotPending(
		offlineDb.shelves,
		payload.shelves?.map(s => withLocalMeta(s, 'synced')),
		item => (item as Shelf).shelfId,
	)
	await upsertIfNotPending(
		offlineDb.warehouses,
		payload.warehouses?.map(w => withLocalMeta(w, 'synced')),
		item => (item as Warehouse).warehouseId,
	)
	await upsertIfNotPending(
		offlineDb.currencies,
		payload.currencies?.map(c => withLocalMeta(c, 'synced')),
		item => (item as Currency).currencyId,
	)
	await upsertIfNotPending(
		offlineDb.units,
		payload.units?.map(u => withLocalMeta(u, 'synced')),
		item => (item as Unit).unitId,
	)
	await upsertIfNotPending(
		offlineDb.expenses,
		payload.expenses?.map(e => withLocalMeta(e, 'synced')),
		item => (item as Expense).expenseId,
	)
	await upsertIfNotPending(
		offlineDb.dailyActions,
		payload.dailyActions?.map(d => withLocalMeta(d, 'synced')),
		item => (item as DailyAction).actionId,
	)

	const invoicesWithFrozenCost = []

	for (const invoice of payload.invoices ?? []) {
		const existing = invoice.invoiceId
			? await offlineDb.invoices.get(invoice.invoiceId)
			: undefined

		invoicesWithFrozenCost.push({
			...invoice,
			invoiceId: invoice.invoiceId,
			items:
				mergeInvoiceItemsPreservingUnitCost(existing?.items, invoice.items) ??
				invoice.items,
		})
	}

	await upsertIfNotPending(
		offlineDb.invoices,
		invoicesWithFrozenCost.map(inv =>
			withLocalMeta({ ...inv, invoiceId: inv.invoiceId }, 'synced'),
		),
		item => item.invoiceId,
	)
	await upsertIfNotPending(
		offlineDb.buyingInvoices,
		payload.buyingInvoices?.map(inv =>
			withLocalMeta({ ...inv, buyingInvoiceId: inv.buyingInvoiceId }, 'synced'),
		),
		item => item.buyingInvoiceId,
	)

	if (payload.serverTime) {
		await setSyncMeta(SYNC_META_KEYS.lastSyncedAt, payload.serverTime)
	}

	if (payload.userSettings) {
		await setSyncMeta('userSettings', JSON.stringify(payload.userSettings))
	}

	if (payload.currencySettings) {
		await setSyncMeta(
			SYNC_META_KEYS.currencySettings,
			JSON.stringify(payload.currencySettings),
		)
	}

	if (payload.invoiceSettings) {
		await setSyncMeta(
			SYNC_META_KEYS.invoiceSettings,
			JSON.stringify(payload.invoiceSettings),
		)
	}

	const retentionDays = Number(
		await getSyncMeta(SYNC_META_KEYS.offlineRetentionDays),
	)
	await pruneExpiredOfflineRecords(
		Number.isFinite(retentionDays) && retentionDays > 0
			? retentionDays
			: OFFLINE_SYNC_RETENTION_DAYS,
	)
}

const outboxChangeListeners = new Set<() => void>()

export const subscribeOutboxChanges = (listener: () => void): (() => void) => {
	outboxChangeListeners.add(listener)
	return () => outboxChangeListeners.delete(listener)
}

export const notifyOutboxChanged = () => {
	for (const listener of outboxChangeListeners) {
		listener()
	}
}

let lastOutboxTime = 0

const nextOutboxCreatedAt = (): string => {
	const now = Date.now()
	lastOutboxTime = Math.max(now, lastOutboxTime + 1)
	return new Date(lastOutboxTime).toISOString()
}

export const putOutboxEntry = async (params: {
	entity: OutboxEntity
	operation: OutboxOperation
	url: string
	method: string
	payload: unknown
	clientMutationId?: string
}): Promise<string> => {
	const id = generateId()
	const clientMutationId = params.clientMutationId ?? generateId()

	await offlineDb.outbox.put({
		id,
		entity: params.entity,
		operation: params.operation,
		url: params.url,
		method: params.method,
		payload: params.payload,
		clientMutationId,
		createdAt: nextOutboxCreatedAt(),
		retryCount: 0,
		status: 'pending',
	})

	return clientMutationId
}

export const addOutboxEntry = async (params: {
	entity: OutboxEntity
	operation: OutboxOperation
	url: string
	method: string
	payload: unknown
	clientMutationId?: string
}): Promise<string> => {
	const clientMutationId = await putOutboxEntry(params)
	notifyOutboxChanged()
	return clientMutationId
}

/**
 * Stock row for a product in one warehouse. Rows cached before warehouse scoping
 * carry no warehouseId; adopting one into the warehouse being written keeps the
 * local quantity correct instead of starting a second row beside it.
 */
export const findLocalInventoryRow = async (
	productId: string,
	warehouseId: string,
): Promise<LocalInventoryItem | undefined> => {
	const rows = await offlineDb.inventory
		.where('productId')
		.equals(productId)
		.toArray()

	const scoped = rows.find(row => row.warehouseId === warehouseId)

	if (scoped) return scoped

	const legacy = rows.find(row => !row.warehouseId)

	return legacy ? { ...legacy, warehouseId } : undefined
}

export const decrementLocalInventory = async (
	productId: string,
	quantity: number,
	warehouseId?: string,
	allowNegative = false,
): Promise<void> => {
	if (!warehouseId) return

	const inventory = await findLocalInventoryRow(productId, warehouseId)

	if (!inventory) return

	const currentQty = Number(inventory.quantity ?? 0)
	const nextQty = allowNegative
		? currentQty - quantity
		: Math.max(0, currentQty - quantity)
	const reserved = Number(inventory.reservedQuantity ?? 0)

	await offlineDb.inventory.put({
		...inventory,
		quantity: nextQty,
		availableQuantity: availableQuantityFromStock(nextQty, reserved),
		syncStatus:
			inventory.syncStatus === 'synced' ? 'pending' : inventory.syncStatus,
		updatedAt: nowIso(),
	})
}

export const incrementLocalInventory = async (
	productId: string,
	quantity: number,
	warehouseId?: string,
): Promise<void> => {
	if (!warehouseId) return

	const inventory = await findLocalInventoryRow(productId, warehouseId)

	if (!inventory) {
		// note: first offline purchase creates a local row; averageCost filled on sync.
		await offlineDb.inventory.put({
			inventoryId: generateId(),
			productId,
			warehouseId,
			quantity,
			availableQuantity: availableQuantityFromStock(quantity),
			reservedQuantity: 0,
			syncStatus: 'pending',
			updatedAt: nowIso(),
		})
		return
	}

	const currentQty = Number(inventory.quantity ?? 0)
	const nextQty = currentQty + quantity
	const reserved = Number(inventory.reservedQuantity ?? 0)

	await offlineDb.inventory.put({
		...inventory,
		quantity: nextQty,
		availableQuantity: availableQuantityFromStock(nextQty, reserved),
		syncStatus:
			inventory.syncStatus === 'synced' ? 'pending' : inventory.syncStatus,
		updatedAt: nowIso(),
	})
}

export const saveLocalInvoice = async (
	invoice: LocalInvoice,
): Promise<void> => {
	await offlineDb.invoices.put(invoice)

	if (invoice.items?.length) {
		const settingsRaw = (
			await offlineDb.syncMeta.get(SYNC_META_KEYS.invoiceSettings)
		)?.value
		const allowNegative = settingsRaw
			? (JSON.parse(settingsRaw) as { allowOversell?: boolean })
					.allowOversell === true
			: false

		for (const item of invoice.items) {
			if (
				invoice.status !== InvoiceStatus.DRAFT &&
				invoice.status !== InvoiceStatus.CANCELLED
			) {
				await decrementLocalInventory(
					item.productId,
					item.quantity,
					invoice.warehouseId,
					allowNegative,
				)
			}
		}
	}
}

const shouldAdjustBuyingInventory = (status?: string): boolean =>
	status !== InvoiceStatus.DRAFT && status !== InvoiceStatus.CANCELLED

export const saveLocalBuyingInvoice = async (
	invoice: LocalBuyingInvoice,
): Promise<void> => {
	await offlineDb.buyingInvoices.put(invoice)

	if (invoice.items?.length && shouldAdjustBuyingInventory(invoice.status)) {
		for (const item of invoice.items) {
			await incrementLocalInventory(
				item.productId,
				item.quantity,
				invoice.warehouseId,
			)
		}
	}
}

export const hasOfflineBootstrapForTenant = async (
	tenantId?: string,
): Promise<boolean> => {
	if (!tenantId || !(await isOfflineCapableForTenant(tenantId))) return false

	const storedTenantId = await getSyncMeta(SYNC_META_KEYS.tenantId)
	const lastSyncedAt = await getSyncMeta(SYNC_META_KEYS.lastSyncedAt)

	return storedTenantId === tenantId && lastSyncedAt !== null
}

export const isOfflineCapable = async (): Promise<boolean> => {
	const value = await getSyncMeta(SYNC_META_KEYS.isOfflineCapable)
	return value === 'true'
}

export const isOfflineCapableForTenant = async (
	tenantId?: string,
): Promise<boolean> => {
	if (!tenantId) return false

	await loadTenantOfflineConfig(tenantId)

	const bootstrapTenantId = await getSyncMeta(SYNC_META_KEYS.tenantId)
	const offlineCapable = await getSyncMeta(SYNC_META_KEYS.isOfflineCapable)

	if (bootstrapTenantId !== tenantId || offlineCapable !== 'true') {
		return false
	}

	const sessionTenantId = await getSyncMeta(SYNC_META_KEYS.sessionTenantId)
	const storedEnabled = await getSyncMeta(SYNC_META_KEYS.tenantOfflineEnabled)

	return !(sessionTenantId === tenantId && storedEnabled === 'false')
}

export const getInvoiceNumberBlockEnd = (nextNumber: number): number =>
	nextNumber + INVOICE_NUMBER_BLOCK_SIZE - 1

export const clearOfflineData = async (): Promise<void> => {
	await offlineDb.transaction(
		'rw',
		[
			offlineDb.products,
			offlineDb.inventory,
			offlineDb.customers,
			offlineDb.suppliers,
			offlineDb.partners,
			offlineDb.categories,
			offlineDb.brands,
			offlineDb.shelves,
			offlineDb.warehouses,
			offlineDb.currencies,
			offlineDb.units,
			offlineDb.expenses,
			offlineDb.dailyActions,
			offlineDb.invoices,
			offlineDb.buyingInvoices,
			offlineDb.catalogProducts,
			offlineDb.syncMeta,
			offlineDb.outbox,
		],
		async () => {
			await offlineDb.products.clear()
			await offlineDb.inventory.clear()
			await offlineDb.customers.clear()
			await offlineDb.suppliers.clear()
			await offlineDb.partners.clear()
			await offlineDb.categories.clear()
			await offlineDb.brands.clear()
			await offlineDb.shelves.clear()
			await offlineDb.warehouses.clear()
			await offlineDb.currencies.clear()
			await offlineDb.units.clear()
			await offlineDb.expenses.clear()
			await offlineDb.dailyActions.clear()
			await offlineDb.invoices.clear()
			await offlineDb.buyingInvoices.clear()
			await offlineDb.catalogProducts.clear()
			await offlineDb.syncMeta.clear()
			await offlineDb.outbox.clear()
		},
	)

	const { resetWorkMode } = await import('./workMode')
	await resetWorkMode()
}
