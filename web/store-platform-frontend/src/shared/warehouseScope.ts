import { offlineDb } from '../offline/db'
import { filterByAllowedProductIds } from './warehouseScopeFilter'

export { filterByAllowedProductIds } from './warehouseScopeFilter'

const STORAGE_PREFIX = 'warehouse-scope:'

type WarehouseScopeListener = (selectedWarehouseIds: string[]) => void

let selectedWarehouseIds: string[] = []
let storageKey: string | null = null
const listeners = new Set<WarehouseScopeListener>()

const readStored = (key: string): string[] | null => {
	try {
		if (typeof window === 'undefined') return null

		const raw = window.localStorage.getItem(key)
		if (!raw) return null

		const parsed = JSON.parse(raw)
		if (!Array.isArray(parsed)) return null

		return parsed.filter(
			(id): id is string => typeof id === 'string' && id.length > 0,
		)
	} catch {
		return null
	}
}

const writeStored = (key: string, ids: string[]): void => {
	if (typeof window === 'undefined') return

	try {
		window.localStorage.setItem(key, JSON.stringify(ids))
	} catch {
		// Storage can be blocked (private mode, quota). Keep memory state.
	}
}

const uniqueIds = (ids: string[]): string[] => [
	...new Set(ids.filter(id => id.length > 0)),
]

const notify = (): void => {
	for (const listener of listeners) {
		listener(selectedWarehouseIds)
	}
}

export const getWarehouseScopeStorageKey = (
	tenantId: string,
	userId?: string | null,
): string => `${STORAGE_PREFIX}${tenantId}:${userId || 'anon'}`

export const getSelectedWarehouseIds = (): string[] => [...selectedWarehouseIds]

export const setSelectedWarehouseIds = (ids: string[]): void => {
	const next = uniqueIds(ids)
	const previous = selectedWarehouseIds
	const unchanged =
		previous.length === next.length &&
		previous.every((id, index) => id === next[index])

	selectedWarehouseIds = next

	if (storageKey) {
		writeStored(storageKey, next)
	}

	if (!unchanged) {
		notify()
	}
}

export const initWarehouseScope = (
	tenantId?: string | null,
	userId?: string | null,
): void => {
	if (!tenantId) {
		storageKey = null
		selectedWarehouseIds = []
		notify()
		return
	}

	storageKey = getWarehouseScopeStorageKey(tenantId, userId)
	selectedWarehouseIds = readStored(storageKey) ?? []
	notify()
}

export const subscribeWarehouseScope = (
	listener: WarehouseScopeListener,
): (() => void) => {
	listeners.add(listener)
	listener(selectedWarehouseIds)
	return () => {
		listeners.delete(listener)
	}
}

export const loadOfflineStockedInScopeProductIds = async (): Promise<
	string[] | null
> => {
	const selected = getSelectedWarehouseIds()
	if (selected.length === 0) return null

	const allowedWarehouses = new Set(selected)
	const inventory = await offlineDb.inventory.toArray()
	const productIds: string[] = []

	for (const row of inventory) {
		const productId = row.productId
		const warehouseId = row.warehouseId
		if (!productId || !warehouseId) continue
		if (!allowedWarehouses.has(warehouseId)) continue
		productIds.push(productId)
	}

	return [...new Set(productIds)]
}

export const filterProductsByWarehouseStock = async <
	T extends { productId?: string },
>(
	products: T[],
): Promise<T[]> => {
	const stockedInScopeProductIds = await loadOfflineStockedInScopeProductIds()
	return filterByAllowedProductIds(products, stockedInScopeProductIds)
}

export const filterInventoryByWarehouseScope = <
	T extends { warehouseId?: string },
>(
	inventory: T[],
): T[] => {
	const selected = getSelectedWarehouseIds()
	if (selected.length === 0) return inventory

	const allowedWarehouses = new Set(selected)
	return inventory.filter(row => {
		const warehouseId = row.warehouseId
		return warehouseId ? allowedWarehouses.has(warehouseId) : false
	})
}
