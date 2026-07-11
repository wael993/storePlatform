import { useCallback, useEffect, useState } from 'react'

import { subscribeConnectivity } from '../../offline/connectivity'
import { getWorkMode } from '../../offline/workMode'

import {
	bootstrapOfflineData,
	getOfflineState,
	initOfflineState,
	subscribeOfflineState,
	syncNow,
	clearSyncPushResult,
} from '../../offline/syncService'
import {
	clearOfflineData,
	hasOfflineBootstrapForTenant,
	isOfflineCapable,
} from '../../offline/localStore'
import { getSyncMeta, SYNC_META_KEYS } from '../../offline/db'
import type { OfflineState } from '../../offline/types'
import { useSyncPushNotifications } from './useSyncPushNotifications'
import {
	isOfflineEnabledForTenant,
	loadTenantOfflineConfig,
} from '../../offline'
import {
	ensureTenantOfflineDataIsolation,
	isOfflineExplicitlyDisabled,
	subscribeTenantOfflineConfig,
} from '../../offline/offlineTenantAccess'

export const useOfflineSync = (tenantId?: string) => {
	const [offlineEnabled, setOfflineEnabled] = useState(() =>
		isOfflineEnabledForTenant(tenantId),
	)
	const [configLoaded, setConfigLoaded] = useState(false)
	const [state, setState] = useState<OfflineState>(getOfflineState())
	const [conflicts, setConflicts] = useState<string[]>([])

	useSyncPushNotifications({
		syncState: state.syncState,
		syncPushResult: state.syncPushResult,
	})

	useEffect(() => {
		if (!tenantId) {
			setOfflineEnabled(false)
			setConfigLoaded(false)
			return
		}

		let cancelled = false

		const initializeTenantOffline = async () => {
			setConfigLoaded(false)

			const enabled = await loadTenantOfflineConfig(tenantId)
			if (cancelled) return

			setOfflineEnabled(enabled)

			const bootstrapTenantId = await getSyncMeta(SYNC_META_KEYS.tenantId)
			const tenantMismatch =
				bootstrapTenantId !== null && bootstrapTenantId !== tenantId

			if (tenantMismatch) {
				await clearOfflineData()
			} else if (
				(await isOfflineExplicitlyDisabled(tenantId)) &&
				(await isOfflineCapable())
			) {
				await clearOfflineData()
			}

			await initOfflineState(tenantId)
			if (cancelled) return

			setConfigLoaded(true)
		}

		void initializeTenantOffline()

		const unsubState = subscribeOfflineState(partial => {
			setState(current => ({ ...current, ...partial }))
		})
		const unsubConnectivity = subscribeConnectivity(isOnline => {
			setState(current => ({ ...current, isOnline }))
		})

		return () => {
			cancelled = true
			unsubState()
			unsubConnectivity()
		}
	}, [tenantId])

	useEffect(() => {
		if (!tenantId) return

		return subscribeTenantOfflineConfig(config => {
			if (config.tenantId === tenantId) {
				setOfflineEnabled(config.offlineEnabled)
			}
		})
	}, [tenantId])

	useEffect(() => {
		if (!tenantId || !configLoaded) return

		const clearDisabledTenantData = async () => {
			if (!(await isOfflineExplicitlyDisabled(tenantId))) return

			if (await isOfflineCapable()) {
				await clearOfflineData()
				await initOfflineState(tenantId)
			}
		}

		void clearDisabledTenantData()
	}, [tenantId, configLoaded, offlineEnabled])

	useEffect(() => {
		if (state.syncState !== 'success') return

		const timer = window.setTimeout(() => {
			clearSyncPushResult()
		}, 6000)

		return () => window.clearTimeout(timer)
	}, [state.syncState])

	useEffect(() => {
		if (!tenantId || !configLoaded || !offlineEnabled) return
		if (getWorkMode() !== 'offline') return

		const restoreOfflineSession = async () => {
			await ensureTenantOfflineDataIsolation(tenantId)

			const hasBootstrap = await hasOfflineBootstrapForTenant(tenantId)
			if (hasBootstrap) {
				await initOfflineState(tenantId)
				return
			}

			try {
				await bootstrapOfflineData(tenantId)
				await initOfflineState(tenantId)
			} catch {
				// User can retry from settings
			}
		}

		void restoreOfflineSession()
	}, [tenantId, offlineEnabled, configLoaded])

	const bootstrap = useCallback(async () => {
		if (!tenantId || !offlineEnabled) return
		await bootstrapOfflineData(tenantId)
		await initOfflineState(tenantId)
	}, [tenantId, offlineEnabled])

	const sync = useCallback(async () => {
		if (!offlineEnabled) return
		try {
			await syncNow()
		} catch {
			// Notifications handled by useSyncPushNotifications
		}

		const { syncPushResult } = getOfflineState()
		if (
			syncPushResult?.type === 'partial' ||
			syncPushResult?.type === 'failed'
		) {
			setConflicts([
				syncPushResult.errorMessage ??
					`${syncPushResult.failedCount} change(s) could not be synced.`,
			])
		} else {
			setConflicts([])
		}
	}, [offlineEnabled])

	const clearConflicts = useCallback(() => setConflicts([]), [])

	return {
		...state,
		offlineEnabled,
		conflicts,
		bootstrap,
		sync,
		clearConflicts,
	}
}
