import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './i18n'
import { ChakraProvider, theme, extendTheme } from '@chakra-ui/react'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import store, { persistor } from './store/store'
import { SettingsProvider } from './shared/context/SettingsContext'
import { loadTenantOfflineConfig } from './offline/offlineTenantAccess'
import { loadWorkModePreference } from './offline/workMode'
import {
	alignAutoWorkModeOnSessionStart,
	initOfflineState,
} from './offline/syncService'
import {
	appShellSrc,
	nextShellScript,
	reloadIfNewShell,
} from './shared/shellUpdate'

const warmOfflineSessionBeforeRender = async (): Promise<void> => {
	const tenantId = store.getState().user?.user?.tenantId
	if (!tenantId) return

	await loadWorkModePreference()
	await loadTenantOfflineConfig(tenantId)
	await initOfflineState(tenantId)
	await alignAutoWorkModeOnSessionStart(tenantId)
}

const warmServiceWorkerRuntimeCache = async (): Promise<void> => {
	if (!navigator.onLine) return

	const assets = [
		...[...document.querySelectorAll('script[src]')].map(
			el => (el as HTMLScriptElement).src,
		),
		...[
			...document.querySelectorAll(
				'link[rel="stylesheet"], link[rel="modulepreload"]',
			),
		].map(el => (el as HTMLLinkElement).href),
	].filter(url => url.startsWith(window.location.origin))

	for (const asset of assets) {
		try {
			await fetch(asset)
		} catch {
			// Ignore while offline
		}
	}
}

const stripShellReloadParam = (): void => {
	const url = new URL(window.location.href)
	if (!url.searchParams.has('__shell')) return
	url.searchParams.delete('__shell')
	window.history.replaceState(
		window.history.state,
		'',
		`${url.pathname}${url.search}${url.hash}`,
	)
}

const checkShellUpdate = async (): Promise<void> => {
	if (!navigator.onLine) return
	const current = appShellSrc(
		[...document.querySelectorAll('script[type="module"]')].map(
			script => script.getAttribute('src') ?? '',
		),
	)
	if (!current) return
	try {
		const response = await fetch('/index.html', { cache: 'no-store' })
		if (!response.ok) return
		const next = nextShellScript(current, await response.text())
		if (next) reloadIfNewShell(next)
	} catch {
		// Offline or a blocked shell fetch keeps the running build.
	}
}

const watchShellUpdates = (): void => {
	void checkShellUpdate()
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') void checkShellUpdate()
	})
}

stripShellReloadParam()

if (import.meta.env.PROD) {
	watchShellUpdates()
}

if ('serviceWorker' in navigator && !import.meta.env.PROD) {
	void navigator.serviceWorker.getRegistrations().then(registrations => {
		if (!registrations.length) return
		void Promise.all(
			registrations.map(registration => registration.unregister()),
		).then(() => window.location.reload())
	})
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
	void navigator.serviceWorker
		.register('/sw.js', { updateViaCache: 'none' })
		.then(registration => {
			const warmWhenReady = () => {
				void warmServiceWorkerRuntimeCache()
			}

			if (registration.active) {
				warmWhenReady()
			}

			registration.addEventListener('updatefound', () => {
				const worker = registration.installing
				worker?.addEventListener('statechange', () => {
					if (worker.state === 'activated') {
						warmWhenReady()
					}
				})
			})
		})
		.catch(() => {
			// Service worker registration is optional
		})

	window.addEventListener('load', () => {
		void warmServiceWorkerRuntimeCache()
	})
}

const appTheme = extendTheme(theme, {
	styles: {
		global: {
			'html, body, #root': {
				maxW: '100%',
				overflowX: 'hidden',
			},
		},
	},
})

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
	<ChakraProvider theme={appTheme}>
		<Provider store={store}>
			<PersistGate
				loading={null}
				persistor={persistor}
				onBeforeLift={warmOfflineSessionBeforeRender}
			>
				<SettingsProvider>
					<App />
				</SettingsProvider>
			</PersistGate>
		</Provider>
	</ChakraProvider>,
)
