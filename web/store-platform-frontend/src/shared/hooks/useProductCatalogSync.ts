import { useEffect } from 'react'

import {
	getIsNetworkOnline,
	subscribeConnectivity,
} from '../../offline/connectivity'
import { getWorkMode } from '../../offline/workMode'
import {
	getProductCatalogState,
	hydrateFromIndexedDB,
	syncFromNetwork,
} from '../../offline/productCatalogStore'
import { TENANT_ACCESSIBLE_PAGE } from '../tenantAccessiblePages'
import { useUser } from './useUser'

const SYNC_INTERVAL_MS = 5 * 60 * 1000

const shouldSyncCatalog = (lastSyncedAt: string | null): boolean => {
	if (!lastSyncedAt) return true
	return Date.now() - new Date(lastSyncedAt).getTime() >= SYNC_INTERVAL_MS
}

export const useProductCatalogSync = () => {
	const { user } = useUser()
	const tenantId = user?.tenantId
	const hasInvoiceAccess = user?.accessiblePages?.includes(
		TENANT_ACCESSIBLE_PAGE.SELLING_INVOICES,
	)

	useEffect(() => {
		if (!tenantId || !hasInvoiceAccess) return

		let intervalId: ReturnType<typeof setInterval> | null = null

		const initializeCatalog = async () => {
			await hydrateFromIndexedDB(tenantId)
			if (getIsNetworkOnline() && getWorkMode() !== 'offline') {
				void syncFromNetwork(tenantId)
			}
		}

		void initializeCatalog()

		intervalId = setInterval(() => {
			if (!getIsNetworkOnline() || getWorkMode() === 'offline') return
			void syncFromNetwork(tenantId)
		}, SYNC_INTERVAL_MS)

		const unsubConnectivity = subscribeConnectivity(isOnline => {
			if (!isOnline || getWorkMode() === 'offline') return

			const { lastSyncedAt } = getProductCatalogState()
			if (shouldSyncCatalog(lastSyncedAt)) {
				void syncFromNetwork(tenantId)
			}
		})

		const handleVisibilityChange = () => {
			if (
				document.visibilityState !== 'visible' ||
				!getIsNetworkOnline() ||
				getWorkMode() === 'offline'
			) {
				return
			}

			const { lastSyncedAt } = getProductCatalogState()
			if (shouldSyncCatalog(lastSyncedAt)) {
				void syncFromNetwork(tenantId)
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)

		return () => {
			if (intervalId) clearInterval(intervalId)
			unsubConnectivity()
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, [tenantId, hasInvoiceAccess])
}
