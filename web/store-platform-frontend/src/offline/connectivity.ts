import { getWorkMode } from './workMode'

type ConnectivityListener = (isOnline: boolean) => void

let networkOnlineState =
	typeof navigator !== 'undefined' ? navigator.onLine : true

const listeners = new Set<ConnectivityListener>()

const getEffectiveOnline = (): boolean =>
	getWorkMode() === 'online' && networkOnlineState

const notify = () => {
	const isOnline = getEffectiveOnline()
	for (const listener of listeners) {
		listener(isOnline)
	}
}

export const notifyEffectiveConnectivityChange = (): void => {
	notify()
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => {
		networkOnlineState = true
		notify()
	})

	window.addEventListener('offline', () => {
		networkOnlineState = false
		notify()
	})
}

export const getIsNetworkOnline = (): boolean => networkOnlineState

export const getIsOnline = (): boolean => getEffectiveOnline()

export const setOnlineFromFetchResult = (failed: boolean): void => {
	if (failed && networkOnlineState) {
		networkOnlineState = false
		notify()
	}
}

export const subscribeConnectivity = (
	listener: ConnectivityListener,
): (() => void) => {
	listeners.add(listener)
	listener(getEffectiveOnline())
	return () => listeners.delete(listener)
}

export const markOnline = (): void => {
	if (!networkOnlineState) {
		networkOnlineState = true
		notify()
	}
}
