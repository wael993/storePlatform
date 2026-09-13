/**
 * Working warehouse scope for the current session.
 * Sent as `x-warehouse-scope` on API requests.
 * Exactly one id = operational mode; two or more = combined view (no posting/stock).
 */

export const WAREHOUSE_SCOPE_HEADER = 'x-warehouse-scope'

type Listener = (ids: string[]) => void

let selectedWarehouseIds: string[] = []
let storageKey: string | null = null
const listeners = new Set<Listener>()

const readStored = (key: string): string[] | null => {
	try {
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
	window.localStorage.setItem(key, JSON.stringify(ids))
}

const notify = (): void => {
	for (const listener of listeners) {
		listener(selectedWarehouseIds)
	}
}

export const getWarehouseScopeIds = (): string[] => selectedWarehouseIds

export const isOperationalWarehouseMode = (): boolean =>
	selectedWarehouseIds.length === 1

export const getOperationalWarehouseId = (): string | null =>
	selectedWarehouseIds.length === 1 ? selectedWarehouseIds[0] : null

const scopeStorageKey = (tenantId: string, userId: string): string =>
	`store-platform-warehouse-scope:v2:${tenantId}:${userId}`

/** Load stored scope for user before API calls (idempotent). */
export const hydrateWarehouseScopeForUser = (
	tenantId?: string,
	userId?: string,
): void => {
	if (!tenantId || !userId) return

	const key = scopeStorageKey(tenantId, userId)
	if (key === storageKey) return

	storageKey = key
	selectedWarehouseIds = readStored(key) ?? []
	notify()
}

export const setWarehouseScopeIds = (ids: string[]): void => {
	const next = [...new Set(ids.filter(Boolean))]
	if (
		next.length === selectedWarehouseIds.length &&
		next.every((id, i) => id === selectedWarehouseIds[i])
	) {
		return
	}

	selectedWarehouseIds = next
	if (storageKey) {
		writeStored(storageKey, next)
	}
	notify()
}

/**
 * Bind scope to user/tenant, prune to accessible warehouses, default to all accessible.
 */
export const syncWarehouseScopeWithAccessible = (
	tenantId: string | undefined,
	userId: string | undefined,
	accessibleIds: string[],
): string[] => {
	const nextKey = tenantId && userId ? scopeStorageKey(tenantId, userId) : null

	if (nextKey !== storageKey) {
		storageKey = nextKey
		selectedWarehouseIds = nextKey ? (readStored(nextKey) ?? []) : []
	}

	// An empty list means "not loaded yet" as often as it means "no access" (offline
	// before the first bootstrap), so keep the stored selection rather than discard it.
	if (accessibleIds.length === 0) {
		return selectedWarehouseIds
	}

	const allowed = new Set(accessibleIds)
	let next = selectedWarehouseIds.filter(id => allowed.has(id))

	// Default to one warehouse (operational). Combined view is an explicit multi-select.
	if (next.length === 0 && accessibleIds.length > 0) {
		next = [accessibleIds[0]]
	}

	if (
		next.length === selectedWarehouseIds.length &&
		next.every((id, i) => id === selectedWarehouseIds[i])
	) {
		return next
	}

	selectedWarehouseIds = next
	if (storageKey) {
		writeStored(storageKey, next)
	}
	notify()
	return next
}

export const subscribeWarehouseScope = (listener: Listener): (() => void) => {
	listeners.add(listener)
	listener(selectedWarehouseIds)
	return () => {
		listeners.delete(listener)
	}
}

/** Logout: drop the in-memory scope and the stored selection for that session. */
export const clearWarehouseScope = (): void => {
	if (storageKey) {
		try {
			window.localStorage.removeItem(storageKey)
		} catch {
			// ignore: a blocked localStorage still leaves the in-memory scope cleared
		}
	}

	selectedWarehouseIds = []
	storageKey = null
	notify()
}
