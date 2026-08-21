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
