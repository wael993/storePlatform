import type { OutboxEntry, SyncPushResult } from './types'
import { offlineDb } from './db'

const markSynced = async <T extends { syncStatus: string; updatedAt: string }>(
	table: { get: (key: string) => Promise<T | undefined>; put: (item: T) => Promise<unknown> },
	key: string,
	serverTime: string,
) => {
	const existing = await table.get(key)
	if (!existing) return

	await table.put({
		...existing,
		syncStatus: 'synced',
		updatedAt: serverTime,
	})
}

const remapBrandId = async (
	clientId: string,
	serverId: string,
	serverTime: string,
) => {
	if (!clientId || clientId === serverId) {
		await markSynced(offlineDb.brands, clientId, serverTime)
		return
	}

	const brand = await offlineDb.brands.get(clientId)
	if (!brand) return

	await offlineDb.brands.delete(clientId)
	await offlineDb.brands.put({
		...brand,
		brandId: serverId,
		syncStatus: 'synced',
		updatedAt: serverTime,
	})
}

export const applyPushResultToLocalStore = async (
	entry: OutboxEntry,
	item: SyncPushResult,
	serverTime: string,
): Promise<void> => {
	if (!item.success) return

	const payload = (entry.payload ?? {}) as Record<string, unknown>
	const data = (item.data ?? {}) as Record<string, unknown>

	switch (entry.entity) {
		case 'invoice': {
			const invoiceId = String(payload.invoiceId ?? '')
			if (!invoiceId) return
			await markSynced(offlineDb.invoices, invoiceId, serverTime)
			return
		}
		case 'product': {
			const productId = String(data.productId ?? payload.productId ?? '')
			if (productId) await markSynced(offlineDb.products, productId, serverTime)
			return
		}
		case 'customer': {
			const customerId = String(data.customerId ?? payload.customerId ?? '')
			if (customerId) await markSynced(offlineDb.customers, customerId, serverTime)
			return
		}
		case 'supplier': {
			const supplierId = String(data.supplierId ?? payload.supplierId ?? '')
			if (supplierId) await markSynced(offlineDb.suppliers, supplierId, serverTime)
			return
		}
		case 'partner': {
			const partnerId = String(data.partnerId ?? payload.partnerId ?? '')
			if (partnerId) await markSynced(offlineDb.partners, partnerId, serverTime)
			return
		}
		case 'category': {
			const categoryId = String(data.categoryId ?? payload.categoryId ?? '')
			if (categoryId) await markSynced(offlineDb.categories, categoryId, serverTime)
			return
		}
		case 'brand': {
			const clientId = String(payload.brandId ?? '')
			const serverId = String(data._id ?? data.brandId ?? clientId)
			await remapBrandId(clientId, serverId, serverTime)
			return
		}
		case 'shelf': {
			const shelfId = String(data.shelfId ?? payload.shelfId ?? '')
			if (shelfId) await markSynced(offlineDb.shelves, shelfId, serverTime)
			return
		}
		case 'warehouse': {
			const warehouseId = String(data.warehouseId ?? payload.warehouseId ?? '')
			if (warehouseId) await markSynced(offlineDb.warehouses, warehouseId, serverTime)
			return
		}
		case 'expense': {
			const expenseId = String(data.expenseId ?? payload.expenseId ?? '')
			if (expenseId) await markSynced(offlineDb.expenses, expenseId, serverTime)
			return
		}
		case 'dailyAction': {
			const actionId = String(
				data.actionId ?? payload.actionId ?? entry.url.split('/').pop() ?? '',
			)
			if (actionId) await markSynced(offlineDb.dailyActions, actionId, serverTime)
			return
		}
		case 'currency': {
			const currencyId = String(data.currencyId ?? payload.currencyId ?? '')
			if (currencyId) await markSynced(offlineDb.currencies, currencyId, serverTime)
			return
		}
		case 'unit': {
			const unitId = String(data.unitId ?? payload.unitId ?? '')
			if (unitId) await markSynced(offlineDb.units, unitId, serverTime)
			return
		}
		default:
			return
	}
}

export const markInventorySyncedAfterPush = async (serverTime: string): Promise<void> => {
	const inventory = await offlineDb.inventory
		.where('syncStatus')
		.equals('pending')
		.toArray()

	for (const item of inventory) {
		const key = item.inventoryId ?? item.productId
		if (!key) continue

		await offlineDb.inventory.put({
			...item,
			syncStatus: 'synced',
			updatedAt: serverTime,
		})
	}
}
