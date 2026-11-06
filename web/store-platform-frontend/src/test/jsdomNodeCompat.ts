// Gaps between jsdom globals and newer Node built-ins. No-ops where they already agree.

// Node ≥25 ships a global localStorage/sessionStorage (undefined without --localstorage-file)
// that shadows jsdom's. Point both back at jsdom.
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window

for (const key of ['localStorage', 'sessionStorage'] as const) {
	if (jsdomWindow && !globalThis[key]) {
		Object.defineProperty(globalThis, key, {
			value: jsdomWindow[key],
			configurable: true,
			writable: true,
		})
	}
}

// Node's Request rejects jsdom's AbortSignal (RTK Query passes one on every call).
// shortcut: drops the signal, so a test cannot abort a request; upgrade if one needs to.
const NodeRequest = globalThis.Request
let signalRejected = false
try {
	new NodeRequest('http://localhost/', { signal: new AbortController().signal })
} catch {
	signalRejected = true
}
if (signalRejected) {
	globalThis.Request = class extends NodeRequest {
		constructor(input: RequestInfo | URL, init?: RequestInit) {
			super(input, init?.signal ? { ...init, signal: undefined } : init)
		}
	}
}
