import type {
	ProductCatalogItem,
	ProductCatalogResponse,
} from '../api/apiStore'
import { mapCatalogItemToProduct } from '../components/SellingInvoice/catalogMappers'
import {
	buildProductSearchIndexes,
	createEmptyProductSearchIndexes,
	type ProductSearchIndexes,
} from '../components/SellingInvoice/productSearch'
import { config } from '../config'
import store from '../store/store'
import { getIsNetworkOnline } from './connectivity'
import { getSyncMeta, offlineDb, setSyncMeta, SYNC_META_KEYS } from './db'
import { hasPendingProductOrInventoryOutbox } from './localStore'
import type { LocalCatalogProduct } from './types'
import {
	getWarehouseScopeIds,
	toWarehouseScopeHeader,
	WAREHOUSE_SCOPE_HEADER,
} from '../shared/warehouseScope'

export interface ProductCatalogState {
	tenantId: string | null
	products: Product[]
	indexes: ProductSearchIndexes
	isReady: boolean
	isSyncing: boolean
	lastSyncedAt: string | null
	lastError: string | null
}

type Listener = (state: ProductCatalogState) => void

const getCatalogMetaKey = (tenantId: string): string =>
	`${SYNC_META_KEYS.catalogLastSyncedAt}:${tenantId}`

const getCatalogScopeMetaKey = (tenantId: string): string =>
	`${SYNC_META_KEYS.catalogScope}:${tenantId}`

let memoryState: ProductCatalogState = {
	tenantId: null,
	products: [],
	indexes: createEmptyProductSearchIndexes(),
	isReady: false,
	isSyncing: false,
	lastSyncedAt: null,
	lastError: null,
}

const listeners = new Set<Listener>()
let syncInFlight: Promise<void> | null = null
/** Warehouse scope the in-flight sync is fetching, so a scope change can re-run it. */
let syncInFlightScopeKey: string | null = null
let activeTenantId: string | null = null

const emit = (partial: Partial<ProductCatalogState>): void => {
	memoryState = { ...memoryState, ...partial }
	for (const listener of listeners) {
		listener(memoryState)
	}
}

const loadMemoryFromItems = (
	tenantId: string,
	items: ProductCatalogItem[],
): void => {
	const products = items.map(mapCatalogItemToProduct)
	const indexes = buildProductSearchIndexes(products)

	emit({
		tenantId,
		products,
		indexes,
		isReady: products.length > 0,
	})
}

export const subscribeProductCatalog = (listener: Listener): (() => void) => {
	listeners.add(listener)
	listener(memoryState)
	return () => listeners.delete(listener)
}

export const getProductCatalogState = (): ProductCatalogState => ({
	...memoryState,
	products: [...memoryState.products],
	indexes: memoryState.indexes,
})

export const getCatalog = (): Product[] => memoryState.products

export const getCatalogIndexes = (): ProductSearchIndexes => memoryState.indexes

export const clearProductCatalogMemory = (): void => {
	activeTenantId = null
	emit({
		tenantId: null,
		products: [],
		indexes: createEmptyProductSearchIndexes(),
		isReady: false,
		isSyncing: false,
		lastSyncedAt: null,
		lastError: null,
	})
}

export const clearForTenant = async (tenantId: string): Promise<void> => {
	if (memoryState.tenantId === tenantId) {
		clearProductCatalogMemory()
	}

	if (activeTenantId === tenantId) {
		activeTenantId = null
	}
}

export const hydrateFromIndexedDB = async (tenantId: string): Promise<void> => {
	if (activeTenantId && activeTenantId !== tenantId) {
		await clearForTenant(activeTenantId)
	}

	activeTenantId = tenantId

	const records = await offlineDb.catalogProducts
		.where('tenantId')
		.equals(tenantId)
		.toArray()

	if (records.length === 0) {
		emit({
			tenantId,
			products: [],
			indexes: createEmptyProductSearchIndexes(),
			isReady: false,
		})
		return
	}

	const storedScope = await getSyncMeta(getCatalogScopeMetaKey(tenantId))
	const currentScope = getWarehouseScopeIds().join(',')

	if (storedScope !== currentScope) {
		emit({
			tenantId,
			products: [],
			indexes: createEmptyProductSearchIndexes(),
			isReady: false,
		})
		return
	}

	loadMemoryFromItems(tenantId, records)

	const lastSyncedAt = await getSyncMeta(getCatalogMetaKey(tenantId))
	emit({ lastSyncedAt })
}

export const reloadTenantCatalogMemory = async (
	tenantId: string,
): Promise<void> => {
	const records = await offlineDb.catalogProducts
		.where('tenantId')
		.equals(tenantId)
		.toArray()

	activeTenantId = tenantId
	loadMemoryFromItems(tenantId, records)
}

export const upsertLocalCatalogProduct = async (
	item: LocalCatalogProduct,
): Promise<void> => {
	await offlineDb.catalogProducts.put(item)
	await reloadTenantCatalogMemory(item.tenantId)
}

export const mergeProductEditIntoLocalCatalog = async (
	productId: string,
	body: Partial<Omit<Product, 'productId' | 'price'>> & {
		price?: Partial<Product['price']>
	},
): Promise<void> => {
	const { applyOnlineProductCatalogEdit } =
		await import('./localProductInventoryMutations')
	await applyOnlineProductCatalogEdit(productId, body)
}

export const removeLocalCatalogProduct = async (
	tenantId: string,
	productId: string,
): Promise<void> => {
	await offlineDb.catalogProducts.delete(productId)
	await reloadTenantCatalogMemory(tenantId)
}

export const syncFromNetwork = async (tenantId: string): Promise<void> => {
	const warehouseScope = getWarehouseScopeIds()
	const scopeKey = warehouseScope.join(',')

	if (!getIsNetworkOnline()) {
		const storedScope = await getSyncMeta(getCatalogScopeMetaKey(tenantId))
		if (storedScope !== scopeKey) {
			emit({
				products: [],
				indexes: createEmptyProductSearchIndexes(),
				isReady: false,
			})
		}
		return
	}

	if (await hasPendingProductOrInventoryOutbox()) {
		return
	}

	if (syncInFlight) {
		await syncInFlight

		// The in-flight sync fetched a different warehouse scope, so its result does not
		// answer this call; run again for the scope actually selected now.
		if (scopeKey === syncInFlightScopeKey) return

		return syncFromNetwork(tenantId)
	}

	syncInFlightScopeKey = scopeKey
	syncInFlight = (async () => {
		emit({ isSyncing: true, lastError: null })

		try {
			const accessToken = store.getState().user?.accessToken
			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
			}

			if (accessToken) {
				headers.Authorization = `Bearer ${accessToken}`
			}

			if (warehouseScope.length > 0) {
				headers[WAREHOUSE_SCOPE_HEADER] = toWarehouseScopeHeader(warehouseScope)
			}

			const response = await fetch(
				`${config.endpoints.storePlatformEndpoint}/products/catalog`,
				{
					credentials: 'include',
					headers,
				},
			)

			if (!response.ok) {
				throw new Error('Catalog sync failed')
			}

			const payload = (await response.json()) as ProductCatalogResponse
			const serverTime = new Date().toISOString()
			const records: LocalCatalogProduct[] = payload.products.map(item => ({
				...item,
				tenantId,
			}))

			await offlineDb.transaction(
				'rw',
				offlineDb.catalogProducts,
				offlineDb.syncMeta,
				async () => {
					await offlineDb.catalogProducts
						.where('tenantId')
						.equals(tenantId)
						.delete()
					await offlineDb.catalogProducts.bulkPut(records)
					await setSyncMeta(getCatalogMetaKey(tenantId), serverTime)
					await setSyncMeta(getCatalogScopeMetaKey(tenantId), scopeKey)
				},
			)

			activeTenantId = tenantId
			loadMemoryFromItems(tenantId, payload.products)
			emit({
				isSyncing: false,
				lastSyncedAt: serverTime,
				lastError: null,
			})
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Catalog sync failed'
			emit({ isSyncing: false, lastError: message })
		}
	})().finally(() => {
		syncInFlight = null
	})

	await syncInFlight
}
