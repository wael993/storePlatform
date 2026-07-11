type ConnectivityListener = (isOnline: boolean) => void

let isOnlineState =
	typeof navigator !== 'undefined' ? navigator.onLine : true

const listeners = new Set<ConnectivityListener>()

const notify = () => {
	for (const listener of listeners) {
		listener(isOnlineState)
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => {
		isOnlineState = true
		notify()
	})

	window.addEventListener('offline', () => {
		isOnlineState = false
		notify()
	})
}

export const getIsOnline = (): boolean => isOnlineState

export const setOnlineFromFetchResult = (failed: boolean): void => {
	if (failed && isOnlineState) {
		isOnlineState = false
		notify()
	}
}

export const subscribeConnectivity = (
	listener: ConnectivityListener,
): (() => void) => {
	listeners.add(listener)
	listener(isOnlineState)
	return () => listeners.delete(listener)
}

export const markOnline = (): void => {
	if (!isOnlineState) {
		isOnlineState = true
		notify()
	}
}
