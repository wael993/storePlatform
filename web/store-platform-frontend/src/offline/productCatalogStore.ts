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
import type { LocalCatalogProduct } from './types'

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

	loadMemoryFromItems(tenantId, records)

	const lastSyncedAt = await getSyncMeta(getCatalogMetaKey(tenantId))
	emit({ lastSyncedAt })
}

export const syncFromNetwork = async (tenantId: string): Promise<void> => {
	if (!getIsNetworkOnline()) return

	if (syncInFlight) {
		await syncInFlight
		return
	}

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
