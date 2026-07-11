import { loadTenantOfflineConfig } from './offlineTenantAccess'
import {
	OFFLINE_SYNC_RETENTION_DAYS,
	pruneExpiredOfflineRecords,
} from './offlineRetention'
import type {
	BootstrapPayload,
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
import { generateId, nowIso, withLocalMeta } from './utils'

const INVOICE_NUMBER_BLOCK_SIZE = 500

export const getLocalNextInvoiceNumber = async (): Promise<number> => {
	const current = Number(await getSyncMeta(SYNC_META_KEYS.nextInvoiceNumber))
	return Number.isFinite(current) && current > 0 ? current : 1
}

export const findDuplicateOutboxEntry = async (
	url: string,
	method: string,
	payload: Record<string, unknown>,
) => {
	const idempotencyKey = [
		url,
		method,
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

	if (!idempotencyKey) return null

	const candidates = await offlineDb.outbox
		.where('status')
		.anyOf(['pending', 'processing', 'failed'])
		.toArray()

	return (
		candidates.find(entry => {
			if (entry.url !== url || entry.method !== method) return false
			const entryPayload = (entry.payload ?? {}) as Record<string, unknown>
			const entryKey = [
				entry.url,
				entry.method,
				entryPayload.invoiceId,
				entryPayload.actionId,
				entryPayload.productId,
				entryPayload.customerId,
				entryPayload.supplierId,
				entryPayload.partnerId,
				entryPayload.expenseId,
				entryPayload.categoryId,
				entryPayload.brandId,
				entryPayload.shelfId,
				entryPayload.warehouseId,
				entryPayload.currencyId,
				entryPayload.unitId,
			]
				.filter(Boolean)
				.join(':')
			return entryKey === idempotencyKey
		}) ?? null
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
			await offlineDb.outbox.clear()

			await offlineDb.products.bulkPut(
				payload.products.map(p => withLocalMeta(p, 'synced')),
			)
			await offlineDb.inventory.bulkPut(
				payload.inventory.map(i => withLocalMeta(i, 'synced')),
			)
			await offlineDb.customers.bulkPut(
				payload.customers.map(c => withLocalMeta(c, 'synced')),
			)
			await offlineDb.suppliers.bulkPut(
				payload.suppliers.map(s => withLocalMeta(s, 'synced')),
			)
			await offlineDb.partners.bulkPut(
				payload.partners.map(p => withLocalMeta(p, 'synced')),
			)
			await offlineDb.categories.bulkPut(
				payload.categories.map(c => withLocalMeta(c, 'synced')),
			)
			await offlineDb.brands.bulkPut(
				payload.brands.map(b => withLocalMeta(b, 'synced')),
			)
			await offlineDb.shelves.bulkPut(
				payload.shelves.map(s => withLocalMeta(s, 'synced')),
			)
			await offlineDb.warehouses.bulkPut(
				payload.warehouses.map(w => withLocalMeta(w, 'synced')),
			)
			await offlineDb.currencies.bulkPut(
				payload.currencies.map(c => withLocalMeta(c, 'synced')),
			)
			await offlineDb.units.bulkPut(
				payload.units.map(u => withLocalMeta(u, 'synced')),
			)
			await offlineDb.expenses.bulkPut(
				payload.expenses.map(e => withLocalMeta(e, 'synced')),
			)
			await offlineDb.dailyActions.bulkPut(
				payload.dailyActions.map(d => withLocalMeta(d, 'synced')),
			)
			await offlineDb.invoices.bulkPut(
				payload.invoices.map(inv =>
					withLocalMeta({ ...inv, invoiceId: inv.invoiceId }, 'synced'),
				),
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
			await setSyncMeta(SYNC_META_KEYS.isOfflineCapable, 'true')
			await setSyncMeta(SYNC_META_KEYS.tenantId, tenantId)

			if (payload.userSettings) {
				await setSyncMeta('userSettings', JSON.stringify(payload.userSettings))
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
	await upsertIfNotPending(
		offlineDb.invoices,
		payload.invoices?.map(inv =>
			withLocalMeta({ ...inv, invoiceId: inv.invoiceId }, 'synced'),
		),
		item => item.invoiceId,
	)

	if (payload.serverTime) {
		await setSyncMeta(SYNC_META_KEYS.lastSyncedAt, payload.serverTime)
	}

	if (payload.userSettings) {
		await setSyncMeta('userSettings', JSON.stringify(payload.userSettings))
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

const notifyOutboxChanged = () => {
	for (const listener of outboxChangeListeners) {
		listener()
	}
}

export const addOutboxEntry = async (params: {
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
		createdAt: nowIso(),
		retryCount: 0,
		status: 'pending',
	})

	notifyOutboxChanged()

	return clientMutationId
}

export const decrementLocalInventory = async (
	productId: string,
	quantity: number,
): Promise<void> => {
	const inventory = await offlineDb.inventory
		.where('productId')
		.equals(productId)
		.first()

	if (!inventory) return

	const currentQty = Number(inventory.quantity ?? 0)
	const nextQty = Math.max(0, currentQty - quantity)
	const reserved = Number(inventory.reservedQuantity ?? 0)

	await offlineDb.inventory.put({
		...inventory,
		quantity: nextQty,
		availableQuantity: Math.max(0, nextQty - reserved),
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
		for (const item of invoice.items) {
			if (invoice.status !== 'draft' && invoice.status !== 'cancelled') {
				await decrementLocalInventory(item.productId, item.quantity)
			}
		}
	}
}

export const hasOfflineBootstrapForTenant = async (
	tenantId?: string,
): Promise<boolean> => {
	if (!tenantId || !(await isOfflineCapable())) return false

	const storedTenantId = await getSyncMeta(SYNC_META_KEYS.tenantId)
	return storedTenantId === tenantId
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
			await offlineDb.syncMeta.clear()
			await offlineDb.outbox.clear()
		},
	)
}
