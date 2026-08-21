/* eslint-disable no-restricted-globals */

const SHELL_CACHE = 'store-platform-shell-v6'
const RUNTIME_CACHE = 'store-platform-runtime-v6'

const SHELL_ASSETS = ['/index.html']

const isStaticAsset = pathname =>
	pathname.startsWith('/assets/') ||
	pathname.startsWith('/fonts/') ||
	/\.(woff2?|png|jpe?g|svg|ico)$/.test(pathname)

const offlineResponse = (body, contentType = 'text/plain') =>
	new Response(body, {
		status: 503,
		statusText: 'Offline',
		headers: { 'Content-Type': contentType },
	})

const offlineHtml = () =>
	offlineResponse(
		'<!DOCTYPE html><html><body><p>Offline. Open the app while online first, then reload.</p></body></html>',
		'text/html',
	)

const getPathname = request => new URL(request.url).pathname

const matchCachedAsset = async (cache, request) => {
	const direct = await cache.match(request)
	if (direct) return direct

	const pathname = getPathname(request)
	const byPath = await cache.match(pathname)
	if (byPath) return byPath

	return cache.match(request, { ignoreSearch: true })
}

const cacheAsset = async (cache, request, response) => {
	await cache.put(request, response.clone())

	const pathname = getPathname(request)
	if (pathname !== request.url) {
		await cache.put(pathname, response.clone())
	}
}

const jsSrcsFromHtml = html =>
	[...html.matchAll(/<script[^>]+src="([^"]+)"/gi)].map(match => {
		const src = match[1]
		return src.startsWith('http') ? new URL(src).pathname : src
	})

const cacheHasJs = async (cache, indexHtml) => {
	if (!indexHtml) return false
	const srcs = jsSrcsFromHtml(await indexHtml.clone().text())
	if (!srcs.length) return false
	const cached = new Set(
		(await cache.keys()).map(key => new URL(key.url).pathname),
	)
	return srcs.every(src => cached.has(src))
}

self.addEventListener('install', event => {
	event.waitUntil(
		(async () => {
			const shellCache = await caches.open(SHELL_CACHE)
			await shellCache.addAll(SHELL_ASSETS).catch(() => undefined)
		})(),
	)
	self.skipWaiting()
})

self.addEventListener('activate', event => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys()
			await Promise.all(
				keys
					.filter(
						key => key !== SHELL_CACHE && key !== RUNTIME_CACHE,
					)
					.map(key => caches.delete(key)),
			)
			await self.clients.claim()
		})(),
	)
})

self.addEventListener('fetch', event => {
	if (event.request.method !== 'GET') return

	const url = new URL(event.request.url)

	if (url.origin !== self.location.origin) return

	if (url.pathname.startsWith('/api/')) return

	if (isStaticAsset(url.pathname)) {
		event.respondWith(
			(async () => {
				const runtimeCache = await caches.open(RUNTIME_CACHE)
				const cached = await matchCachedAsset(runtimeCache, event.request)
				if (cached) return cached

				try {
					const response = await fetch(event.request)
					if (response.ok) {
						await cacheAsset(runtimeCache, event.request, response)
					}
					return response
				} catch {
					const fallback = await matchCachedAsset(runtimeCache, event.request)
					return fallback ?? offlineResponse('Asset unavailable offline')
				}
			})(),
		)
		return
	}

	if (event.request.mode !== 'navigate') return

	event.respondWith(
		(async () => {
			const shellCache = await caches.open(SHELL_CACHE)
			const runtimeCache = await caches.open(RUNTIME_CACHE)
			const cachedIndex = await shellCache.match('/index.html')
			const hasOfflineShell =
				Boolean(cachedIndex) && (await cacheHasJs(runtimeCache, cachedIndex))

			if (!hasOfflineShell) {
				try {
					const response = await fetch(event.request)
					if (response.ok) {
						await shellCache.put(event.request, response.clone())
						await shellCache.put('/index.html', response.clone())
					}
					return response
				} catch {
					return offlineHtml()
				}
			}

			try {
				const response = await fetch(event.request)
				if (response.ok) {
					await shellCache.put(event.request, response.clone())
					await shellCache.put('/index.html', response.clone())
					return response
				}
			} catch {
				// Serve cached shell below
			}

			const cachedRoute = await shellCache.match(event.request)
			if (cachedRoute) return cachedRoute

			if (cachedIndex) return cachedIndex

			return offlineHtml()
		})(),
	)
})
