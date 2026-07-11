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
import { loadWorkMode } from './offline/workMode'
import { initOfflineState } from './offline/syncService'

const warmOfflineSessionBeforeRender = async (): Promise<void> => {
	const tenantId = store.getState().user?.user?.tenantId
	if (!tenantId) return

	await loadWorkMode()
	await loadTenantOfflineConfig(tenantId)
	await initOfflineState(tenantId)
}

const warmServiceWorkerRuntimeCache = async (): Promise<void> => {
	if (!navigator.onLine) return

	const assets = ['/static/js/bundle.js', '/static/css/main.css']
	for (const asset of assets) {
		try {
			await fetch(asset)
		} catch {
			// Ignore while offline
		}
	}

	const controller = navigator.serviceWorker.controller
	controller?.postMessage({ type: 'WARM_RUNTIME_CACHE' })
}

if ('serviceWorker' in navigator) {
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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
