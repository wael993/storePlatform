import { config } from '../config'
import store from '../store/store'
import { setAccessToken } from '../store/user/reducer'
import {
	getPendingOutboxCount,
	getProcessingOutboxCount,
	getSyncMeta,
	offlineDb,
	SYNC_META_KEYS,
} from './db'
import {
	getIsNetworkOnline,
	getIsOnline,
	markOnline,
	setOnlineFromFetchResult,
	subscribeConnectivity,
	subscribeNetworkOnline,
} from './connectivity'
import {
	loadTenantOfflineConfig,
	isOfflineEnabledForTenant,
} from './offlineTenantAccess'
import {
	getWorkMode,
	getWorkModePreference,
	isAutoWorkMode,
	setWorkMode,
} from './workMode'
import {
	applyBootstrapPayload,
	applySyncChanges,
	getInvoiceNumberBlockEnd,
	isOfflineCapable,
	isOfflineCapableForTenant,
	subscribeOutboxChanges,
} from './localStore'
import {
	OFFLINE_SYNC_RETENTION_DAYS,
	pruneExpiredOfflineRecords,
} from './offlineRetention'
import {
	applyPushResultToLocalStore,
	markInventorySyncedAfterPush,
} from './pushLocalSync'
import type {
	BootstrapPayload,
	OfflineState,
	OutboxEntry,
	SyncPushResponse,
} from './types'

type StateListener = (state: Partial<OfflineState>) => void

const stateListeners = new Set<StateListener>()

let currentState: OfflineState = {
	isOnline: getIsOnline(),
	syncState: 'idle',
	pendingCount: 0,
	lastSyncedAt: null,
	lastError: null,
	isOfflineCapable: false,
	syncPushResult: null,
}

const emit = (partial: Partial<OfflineState>) => {
	currentState = { ...currentState, ...partial }
	for (const listener of stateListeners) {
		listener(partial)
	}
}

export const getOfflineState = (): OfflineState => currentState

export const subscribeOfflineState = (
	listener: StateListener,
): (() => void) => {
	stateListeners.add(listener)
	listener(currentState)
	return () => stateListeners.delete(listener)
}

const refreshPendingCount = async () => {
	const pendingCount = await getPendingOutboxCount()
	emit({ pendingCount })
}

export const notifyPendingCountChanged = (): void => {
	void refreshPendingCount()
}

subscribeOutboxChanges(() => {
	notifyPendingCountChanged()
})

let pushInFlight: Promise<void> | null = null

const isNetworkFetchError = (error: unknown): boolean => {
	if (error instanceof TypeError) return true
	if (error instanceof Error) {
		const message = error.message.toLowerCase()
		return (
			message.includes('failed to fetch') ||
			message.includes('networkerror') ||
			message.includes('network request failed') ||
			message.includes('load failed')
		)
	}
	return false
}

const restoreOutboxEntriesAfterNetworkFailure = async (
	entries: Array<{ id: string; status: OutboxEntry['status'] }>,
): Promise<void> => {
	for (const entry of entries) {
		await offlineDb.outbox.update(entry.id, {
			status: entry.status === 'failed' ? 'failed' : 'pending',
		})
	}
}

const resetInterruptedOutboxEntries = async (): Promise<void> => {
	const processingEntries = await offlineDb.outbox
		.where('status')
		.equals('processing')
		.toArray()

	for (const entry of processingEntries) {
		await offlineDb.outbox.update(entry.id, { status: 'pending' })
	}

	const failedEntries = await offlineDb.outbox
		.where('status')
		.equals('failed')
		.toArray()

	for (const entry of failedEntries) {
		if (entry.lastError && isNetworkFetchError(new Error(entry.lastError))) {
			await offlineDb.outbox.update(entry.id, {
				status: 'pending',
				lastError: undefined,
			})
		}
	}
}

const isActivePushSyncState = (syncState: OfflineState['syncState']): boolean =>
	syncState === 'syncing' ||
	syncState === 'success' ||
	(syncState === 'error' && currentState.syncPushResult !== null)

const refreshAccessToken = async (): Promise<void> => {
	const response = await fetch(
		`${config.endpoints.storePlatformEndpoint}/refresh`,
		{
			method: 'POST',
			credentials: 'include',
		},
	)

	if (!response.ok) {
		throw new Error('Session expired. Please log in again.')
	}

	const data = (await response.json()) as { accessToken?: string }
	if (!data.accessToken) {
		throw new Error('Session expired. Please log in again.')
	}

	store.dispatch(setAccessToken(data.accessToken))
}

const fetchWithAuth = async (
	path: string,
	options: RequestInit = {},
): Promise<Response> => {
	const accessToken = store.getState().user?.accessToken

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(options.headers as Record<string, string>),
	}

	if (accessToken) {
		headers.Authorization = `Bearer ${accessToken}`
	}

	return fetch(`${config.endpoints.storePlatformEndpoint}/${path}`, {
		...options,
		credentials: 'include',
		headers,
	})
}

export const bootstrapOfflineData = async (tenantId: string): Promise<void> => {
	if (!getIsNetworkOnline()) {
		throw new Error('Cannot bootstrap without a network connection')
	}

	emit({ syncState: 'bootstrapping', lastError: null })

	try {
		const response = await fetchWithAuth('sync/bootstrap')

		if (!response.ok) {
			const errorBody = await response.json().catch(() => ({}))
			throw new Error(errorBody.message ?? 'Bootstrap failed')
		}

		const payload = (await response.json()) as BootstrapPayload
		await applyBootstrapPayload(payload, tenantId)
		markOnline()

		emit({
			syncState: 'idle',
			lastSyncedAt: payload.serverTime,
			isOfflineCapable: true,
			lastError: null,
		})
		await refreshPendingCount()
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Bootstrap failed'
		emit({ syncState: 'error', lastError: message })
		throw error
	}
}

export const pullSyncChanges = async (): Promise<void> => {
	if (!getIsNetworkOnline()) return

	const lastSyncedAt = await getSyncMeta(SYNC_META_KEYS.lastSyncedAt)
	if (!lastSyncedAt) return

	const response = await fetchWithAuth(
		`sync/changes?since=${encodeURIComponent(lastSyncedAt)}`,
	)

	if (!response.ok) {
		const errorBody = await response.json().catch(() => ({}))
		const message =
			(errorBody as { message?: string }).message ?? 'Pull sync failed'
		emit({ lastError: message })
		return
	}

	const payload = await response.json()
	await applySyncChanges(payload)
	emit({ lastSyncedAt: payload.serverTime, lastError: null })
}

export const pushOutbox = async (options?: {
	force?: boolean
}): Promise<void> => {
	if (pushInFlight) return pushInFlight

	pushInFlight = runPushOutbox(options).finally(() => {
		pushInFlight = null
	})

	return pushInFlight
}

const runPushOutbox = async (options?: { force?: boolean }): Promise<void> => {
	if (!getIsNetworkOnline()) {
		emit({ syncState: 'offline' })
		return
	}

	if (!options?.force && getWorkMode() === 'offline') {
		return
	}

	const pendingEntries = await offlineDb.outbox
		.where('status')
		.anyOf(['pending', 'failed'])
		.sortBy('createdAt')

	if (pendingEntries.length === 0) {
		const processingCount = await getProcessingOutboxCount()
		if (isActivePushSyncState(currentState.syncState) || processingCount > 0) {
			await refreshPendingCount()
			return
		}

		emit({ syncState: 'idle', syncPushResult: null })
		await refreshPendingCount()
		return
	}

	emit({ syncState: 'syncing', lastError: null, syncPushResult: null })

	const entriesBeforePush = pendingEntries.map(entry => ({
		id: entry.id,
		status: entry.status,
	}))

	try {
		for (const entry of pendingEntries) {
			await offlineDb.outbox.update(entry.id, { status: 'processing' })
		}

		const retryClientMutationIds = pendingEntries
			.filter(entry => entry.status === 'failed' || entry.retryCount > 0)
			.map(entry => entry.clientMutationId)

		const response = await fetchWithAuth('sync/push', {
			method: 'POST',
			body: JSON.stringify({
				retryClientMutationIds,
				entries: pendingEntries.map(entry => ({
					clientMutationId: entry.clientMutationId,
					entity: entry.entity,
					operation: entry.operation,
					url: entry.url,
					method: entry.method,
					payload: entry.payload,
				})),
			}),
		})

		if (!response.ok) {
			const errorBody = await response.json().catch(() => ({}))
			throw new Error(errorBody.message ?? 'Sync push failed')
		}

		const result = (await response.json()) as SyncPushResponse

		let syncedCount = 0
		let failedCount = 0
		const failedErrors: string[] = []

		for (const item of result.results) {
			const entry = pendingEntries.find(
				e => e.clientMutationId === item.clientMutationId,
			)
			if (!entry) continue

			if (item.success) {
				syncedCount += 1
				await offlineDb.outbox.update(entry.id, { status: 'completed' })
				await applyPushResultToLocalStore(entry, item, result.serverTime)
			} else {
				failedCount += 1
				if (item.error) failedErrors.push(item.error)
				await offlineDb.outbox.update(entry.id, {
					status: 'failed',
					retryCount: entry.retryCount + 1,
					lastError: item.error,
				})
			}
		}

		for (const entry of pendingEntries) {
			const current = await offlineDb.outbox.get(entry.id)
			if (current?.status !== 'processing') continue

			failedCount += 1
			await offlineDb.outbox.update(entry.id, {
				status: 'failed',
				retryCount: entry.retryCount + 1,
				lastError: 'Sync response did not include this entry',
			})
		}

		if (failedCount > 0) {
			const errorMessage = failedErrors[0]
			markOnline()
			await refreshPendingCount()
			emit({
				syncState: 'error',
				lastSyncedAt: result.serverTime,
				lastError: errorMessage ?? 'Some changes failed to sync',
				syncPushResult: {
					type: syncedCount > 0 ? 'partial' : 'failed',
					syncedCount,
					failedCount,
					errorMessage,
				},
			})
			return
		}

		await markInventorySyncedAfterPush(result.serverTime)
		await pullSyncChanges()
		markOnline()
		await refreshPendingCount()

		emit({
			syncState: 'success',
			lastSyncedAt: result.serverTime,
			lastError: null,
			syncPushResult: {
				type: 'success',
				syncedCount,
				failedCount: 0,
			},
		})
	} catch (error) {
		if (isNetworkFetchError(error)) {
			setOnlineFromFetchResult(true)
			await restoreOutboxEntriesAfterNetworkFailure(entriesBeforePush)
			emit({
				syncState: 'offline',
				lastError: null,
				syncPushResult: null,
			})
			await refreshPendingCount()
			return
		}

		for (const entry of pendingEntries) {
			await offlineDb.outbox.update(entry.id, {
				status: 'failed',
				retryCount: entry.retryCount + 1,
				lastError: error instanceof Error ? error.message : 'Sync failed',
			})
		}

		const message = error instanceof Error ? error.message : 'Sync failed'
		emit({
			syncState: 'error',
			lastError: message,
			syncPushResult: {
				type: 'failed',
				syncedCount: 0,
				failedCount: pendingEntries.length,
				errorMessage: message,
			},
		})
		await refreshPendingCount()
		throw error
	}
}

export const syncNow = async (options?: { force?: boolean }): Promise<void> => {
	await pushOutbox(options)
}

const BOOTSTRAP_REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000
const AUTO_MODE_DEBOUNCE_MS = 2000

let bootstrapRefreshIntervalId: ReturnType<typeof setInterval> | null = null
let autoModeSwitchTimer: ReturnType<typeof setTimeout> | null = null
let autoModeSwitchInFlight = false

export const maybeRefreshOfflineData = async (
	tenantId: string,
): Promise<void> => {
	if (!getIsNetworkOnline()) return
	if (!isOfflineEnabledForTenant(tenantId)) return
	if (getWorkModePreference() === 'offline') return

	const capable = await isOfflineCapable()
	if (!capable && getWorkModePreference() !== 'auto') return

	await bootstrapOfflineData(tenantId)
}

export const runFullSync = async (tenantId: string): Promise<void> => {
	if (!getIsNetworkOnline()) {
		throw new Error('Network connection required to sync')
	}

	await pushOutbox({ force: getWorkMode() === 'offline' })

	const { syncPushResult } = getOfflineState()
	if (syncPushResult?.type === 'partial' || syncPushResult?.type === 'failed') {
		throw new Error(
			syncPushResult.errorMessage ??
				'Some offline changes could not be synced. Please retry.',
		)
	}

	await bootstrapOfflineData(tenantId)
	await pullSyncChanges()

	if (isAutoWorkMode()) {
		await setWorkMode('online')
	}

	await initOfflineState(tenantId)
}

export const alignAutoWorkModeOnSessionStart = async (
	tenantId: string,
): Promise<void> => {
	if (!isAutoWorkMode()) return
	if (!isOfflineEnabledForTenant(tenantId)) return

	if (getIsNetworkOnline()) {
		if (getWorkMode() === 'offline') {
			try {
				await exitOfflineWorkMode(tenantId)
			} catch {
				// Stay offline until push succeeds
			}
		}

		try {
			await maybeRefreshOfflineData(tenantId)
		} catch {
			// Bootstrap refresh is best-effort on session start
		}
		return
	}

	const capable = await isOfflineCapable()
	if (capable && getWorkMode() !== 'offline') {
		await setWorkMode('offline')
		await initOfflineState(tenantId)
	}
}

export const startPeriodicBootstrapRefresh = (
	tenantId: string,
): (() => void) => {
	if (bootstrapRefreshIntervalId) {
		clearInterval(bootstrapRefreshIntervalId)
	}

	bootstrapRefreshIntervalId = setInterval(() => {
		void maybeRefreshOfflineData(tenantId).catch(() => {
			// Periodic refresh is best-effort
		})
	}, BOOTSTRAP_REFRESH_INTERVAL_MS)

	return () => {
		if (bootstrapRefreshIntervalId) {
			clearInterval(bootstrapRefreshIntervalId)
			bootstrapRefreshIntervalId = null
		}
	}
}

const switchToAutoOffline = async (tenantId: string): Promise<void> => {
	if (getWorkMode() === 'offline') return

	const capable = await isOfflineCapable()
	if (capable) {
		await setWorkMode('offline')
		await initOfflineState(tenantId)
	}
}

const switchToAutoOnline = async (tenantId: string): Promise<void> => {
	if (getWorkMode() === 'online') return

	try {
		await exitOfflineWorkMode(tenantId)
	} catch {
		// Stay offline; error state is surfaced by sync service
	}
}

const scheduleAutoWorkModeSwitch = (isNetworkOnline: boolean): void => {
	if (!isAutoWorkMode()) return

	if (autoModeSwitchTimer) {
		clearTimeout(autoModeSwitchTimer)
	}

	autoModeSwitchTimer = setTimeout(() => {
		autoModeSwitchTimer = null
		void (async () => {
			if (autoModeSwitchInFlight) return

			const tenantId = await getSyncMeta(SYNC_META_KEYS.tenantId)
			if (!tenantId || !isOfflineEnabledForTenant(tenantId)) return

			autoModeSwitchInFlight = true
			try {
				if (isNetworkOnline) {
					await switchToAutoOnline(tenantId)
				} else {
					await switchToAutoOffline(tenantId)
				}
			} finally {
				autoModeSwitchInFlight = false
			}
		})()
	}, AUTO_MODE_DEBOUNCE_MS)
}

subscribeNetworkOnline(scheduleAutoWorkModeSwitch)

export const clearSyncPushResult = (): void => {
	emit({ syncState: 'idle', syncPushResult: null })
}

export const initOfflineState = async (tenantId?: string): Promise<void> => {
	if (
		currentState.syncState === 'bootstrapping' ||
		currentState.syncState === 'syncing'
	) {
		return
	}

	if (tenantId) {
		await loadTenantOfflineConfig(tenantId)
	}

	await resetInterruptedOutboxEntries()

	const capable = tenantId
		? await isOfflineCapableForTenant(tenantId)
		: await isOfflineCapable()

	if (capable) {
		const retentionDays = Number(
			await getSyncMeta(SYNC_META_KEYS.offlineRetentionDays),
		)
		await pruneExpiredOfflineRecords(
			Number.isFinite(retentionDays) && retentionDays > 0
				? retentionDays
				: OFFLINE_SYNC_RETENTION_DAYS,
		)
	}

	const lastSyncedAt = await getSyncMeta(SYNC_META_KEYS.lastSyncedAt)
	const pendingCount = await getPendingOutboxCount()

	const preserveSyncState = isActivePushSyncState(currentState.syncState)

	emit({
		isOnline: getIsOnline(),
		isOfflineCapable: capable,
		lastSyncedAt,
		pendingCount,
		syncState: preserveSyncState
			? currentState.syncState
			: getIsOnline()
				? 'idle'
				: 'offline',
		lastError: null,
		syncPushResult: null,
	})

	if (getIsOnline() && capable && pendingCount > 0) {
		void onReconnect()
	}
}

export const onReconnect = async (): Promise<void> => {
	if (!getIsOnline()) return

	const tenantId = await getSyncMeta(SYNC_META_KEYS.tenantId)
	if (!tenantId || !isOfflineEnabledForTenant(tenantId)) return

	const capable = await isOfflineCapable()
	if (!capable) return

	try {
		await pushOutbox()
	} catch {
		// State already updated by pushOutbox
	}

	try {
		await pullSyncChanges()
	} catch {
		// Pull is best-effort on reconnect
	}
}

let connectivityPreviousOnline: boolean | null = null

subscribeConnectivity(isOnline => {
	const wasOnline = connectivityPreviousOnline
	connectivityPreviousOnline = isOnline

	if (isOnline && wasOnline === false && getWorkMode() === 'online') {
		if (!isAutoWorkMode()) {
			void onReconnect()
		}
	}
})

export const enterOfflineWorkMode = async (tenantId: string): Promise<void> => {
	if (!getIsNetworkOnline()) {
		throw new Error('Network connection required to download offline data')
	}

	const pendingCount = await getPendingOutboxCount()
	if (pendingCount > 0) {
		await pushOutbox({ force: true })
	}

	await bootstrapOfflineData(tenantId)
	await setWorkMode('offline')
	await initOfflineState(tenantId)
}

export const exitOfflineWorkMode = async (tenantId?: string): Promise<void> => {
	if (!getIsNetworkOnline()) {
		throw new Error('Network connection required to sync changes')
	}

	await refreshAccessToken()
	await pushOutbox({ force: true })

	const { syncPushResult } = getOfflineState()
	if (syncPushResult?.type === 'partial' || syncPushResult?.type === 'failed') {
		throw new Error(
			syncPushResult.errorMessage ??
				'Some offline changes could not be synced. Please retry.',
		)
	}

	await setWorkMode('online')
	await initOfflineState(tenantId)
}

export { getInvoiceNumberBlockEnd }
