import { getSyncMeta, setSyncMeta, SYNC_META_KEYS } from './db'

type TenantOfflineConfig = {
	tenantId: string
	offlineEnabled: boolean
}

let cachedConfig: TenantOfflineConfig | null = null

type ConfigListener = (config: TenantOfflineConfig) => void
const configListeners = new Set<ConfigListener>()

const notifyConfigListeners = (): void => {
	if (!cachedConfig) return
	for (const listener of configListeners) {
		listener(cachedConfig)
	}
}

export const subscribeTenantOfflineConfig = (
	listener: ConfigListener,
): (() => void) => {
	configListeners.add(listener)
	if (cachedConfig) listener(cachedConfig)
	return () => configListeners.delete(listener)
}

export const setTenantOfflineConfig = async (
	tenantId?: string,
	offlineEnabled?: boolean,
): Promise<void> => {
	if (!tenantId) return

	const enabled = offlineEnabled !== false
	cachedConfig = { tenantId, offlineEnabled: enabled }

	await setSyncMeta(SYNC_META_KEYS.sessionTenantId, tenantId)
	await setSyncMeta(SYNC_META_KEYS.tenantOfflineEnabled, String(enabled))
	notifyConfigListeners()
}

export const clearTenantOfflineConfig = (): void => {
	cachedConfig = null
}

export const onAuthLogout = (): void => {
	clearTenantOfflineConfig()
	void import('./productCatalogStore').then(module =>
		module.clearProductCatalogMemory(),
	)
	void import('./localStore').then(module => module.clearOfflineData())
}

export const isOfflineEnabledForTenant = (tenantId?: string): boolean => {
	if (!tenantId) return false

	if (cachedConfig?.tenantId === tenantId) {
		return cachedConfig.offlineEnabled
	}

	return false
}

export const loadTenantOfflineConfig = async (
	tenantId: string,
): Promise<boolean> => {
	if (cachedConfig?.tenantId === tenantId) {
		return cachedConfig.offlineEnabled
	}

	const sessionTenantId = await getSyncMeta(SYNC_META_KEYS.sessionTenantId)
	const storedEnabled = await getSyncMeta(SYNC_META_KEYS.tenantOfflineEnabled)

	if (sessionTenantId === tenantId && storedEnabled !== null) {
		const enabled = storedEnabled !== 'false'
		cachedConfig = { tenantId, offlineEnabled: enabled }
		return enabled
	}

	const bootstrapTenantId = await getSyncMeta(SYNC_META_KEYS.tenantId)
	const offlineCapable = await getSyncMeta(SYNC_META_KEYS.isOfflineCapable)
	if (bootstrapTenantId === tenantId && offlineCapable === 'true') {
		cachedConfig = { tenantId, offlineEnabled: true }
		await setSyncMeta(SYNC_META_KEYS.sessionTenantId, tenantId)
		await setSyncMeta(SYNC_META_KEYS.tenantOfflineEnabled, 'true')
		return true
	}

	return false
}

export const hasValidOfflineSession = async (
	tenantId?: string,
): Promise<boolean> => {
	if (!tenantId) return false

	const enabled = await loadTenantOfflineConfig(tenantId)
	if (!enabled) return false

	const bootstrapTenantId = await getSyncMeta(SYNC_META_KEYS.tenantId)
	const offlineCapable = await getSyncMeta(SYNC_META_KEYS.isOfflineCapable)

	return bootstrapTenantId === tenantId && offlineCapable === 'true'
}

export const isOfflineExplicitlyDisabled = async (
	tenantId: string,
): Promise<boolean> => {
	const sessionTenantId = await getSyncMeta(SYNC_META_KEYS.sessionTenantId)
	const storedEnabled = await getSyncMeta(SYNC_META_KEYS.tenantOfflineEnabled)

	return sessionTenantId === tenantId && storedEnabled === 'false'
}

export const ensureTenantOfflineDataIsolation = async (
	tenantId: string,
): Promise<boolean> => {
	const bootstrapTenantId = await getSyncMeta(SYNC_META_KEYS.tenantId)

	if (bootstrapTenantId && bootstrapTenantId !== tenantId) {
		const { clearOfflineData } = await import('./localStore')
		await clearOfflineData()
		return true
	}

	return false
}
