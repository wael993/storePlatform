import { getSyncMeta, setSyncMeta, SYNC_META_KEYS } from './db'
import { notifyEffectiveConnectivityChange } from './connectivity'

export type WorkMode = 'online' | 'offline'
export type WorkModePreference = WorkMode | 'auto'

type WorkModeListener = (mode: WorkMode) => void
type WorkModePreferenceListener = (preference: WorkModePreference) => void

let workMode: WorkMode = 'online'
let workModePreference: WorkModePreference = 'online'
const listeners = new Set<WorkModeListener>()
const preferenceListeners = new Set<WorkModePreferenceListener>()

export const getWorkMode = (): WorkMode => workMode

export const getWorkModePreference = (): WorkModePreference => workModePreference

export const isAutoWorkMode = (): boolean => workModePreference === 'auto'

export const loadWorkMode = async (): Promise<WorkMode> => {
	const [storedMode, storedPreference] = await Promise.all([
		getSyncMeta(SYNC_META_KEYS.workMode),
		getSyncMeta(SYNC_META_KEYS.workModePreference),
	])

	if (storedPreference === 'online' || storedPreference === 'offline') {
		workModePreference = storedPreference
	} else if (storedPreference === 'auto') {
		workModePreference = 'auto'
	}

	if (storedMode === 'online' || storedMode === 'offline') {
		workMode = storedMode
	}

	return workMode
}

export const loadWorkModePreference = async (): Promise<WorkModePreference> => {
	await loadWorkMode()
	return workModePreference
}

export const setWorkMode = async (mode: WorkMode): Promise<void> => {
	workMode = mode
	await setSyncMeta(SYNC_META_KEYS.workMode, mode)

	for (const listener of listeners) {
		listener(mode)
	}

	notifyEffectiveConnectivityChange()
}

export const setWorkModePreference = async (
	preference: WorkModePreference,
): Promise<void> => {
	workModePreference = preference
	await setSyncMeta(SYNC_META_KEYS.workModePreference, preference)

	for (const listener of preferenceListeners) {
		listener(preference)
	}
}

export const subscribeWorkMode = (listener: WorkModeListener): (() => void) => {
	listeners.add(listener)
	listener(workMode)
	return () => listeners.delete(listener)
}

export const subscribeWorkModePreference = (
	listener: WorkModePreferenceListener,
): (() => void) => {
	preferenceListeners.add(listener)
	listener(workModePreference)
	return () => preferenceListeners.delete(listener)
}

export const resetWorkMode = async (): Promise<void> => {
	workMode = 'online'
	workModePreference = 'online'
	await setSyncMeta(SYNC_META_KEYS.workMode, 'online')
	await setSyncMeta(SYNC_META_KEYS.workModePreference, 'online')
	notifyEffectiveConnectivityChange()
}
