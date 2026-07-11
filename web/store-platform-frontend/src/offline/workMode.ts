import { getSyncMeta, setSyncMeta, SYNC_META_KEYS } from './db'
import { notifyEffectiveConnectivityChange } from './connectivity'

export type WorkMode = 'online' | 'offline'

type WorkModeListener = (mode: WorkMode) => void

let workMode: WorkMode = 'online'
const listeners = new Set<WorkModeListener>()

export const getWorkMode = (): WorkMode => workMode

export const loadWorkMode = async (): Promise<WorkMode> => {
	const stored = await getSyncMeta(SYNC_META_KEYS.workMode)

	if (stored === 'online' || stored === 'offline') {
		workMode = stored
	}

	return workMode
}

export const setWorkMode = async (mode: WorkMode): Promise<void> => {
	workMode = mode
	await setSyncMeta(SYNC_META_KEYS.workMode, mode)

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
	workMode = 'online'
	await setSyncMeta(SYNC_META_KEYS.workMode, 'online')
	notifyEffectiveConnectivityChange()
}
