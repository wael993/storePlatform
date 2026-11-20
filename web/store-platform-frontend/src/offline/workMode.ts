import { getSyncMeta, setSyncMeta, SYNC_META_KEYS } from './db'
import { notifyEffectiveConnectivityChange } from './connectivity'

export type WorkMode = 'online' | 'offline'

type WorkModeListener = (mode: WorkMode) => void

let workMode: WorkMode = 'online'
const listeners = new Set<WorkModeListener>()

export const getWorkMode = (): WorkMode => workMode

export const loadWorkMode = async (): Promise<WorkMode> => {
	const storedMode = await getSyncMeta(SYNC_META_KEYS.workMode)

	if (storedMode === 'online' || storedMode === 'offline') {
		workMode = storedMode
	}

	return workMode
}

// Save first: if storage throws, memory and the radios stay on the old mode together.
export const setWorkMode = async (mode: WorkMode): Promise<void> => {
	await setSyncMeta(SYNC_META_KEYS.workMode, mode)
	workMode = mode

	for (const listener of listeners) {
		listener(mode)
	}

	notifyEffectiveConnectivityChange()
}

export const subscribeWorkMode = (listener: WorkModeListener): (() => void) => {
	listeners.add(listener)
	listener(workMode)
	return () => listeners.delete(listener)
}

export const resetWorkMode = async (): Promise<void> => {
	await setSyncMeta(SYNC_META_KEYS.workMode, 'online')
	workMode = 'online'
	for (const listener of listeners) {
		listener('online')
	}
	notifyEffectiveConnectivityChange()
}
