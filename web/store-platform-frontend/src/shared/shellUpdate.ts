const SHELL_RELOAD_KEY = 'store-platform-shell-reload'
const SHELL_RELOAD_MS = 10 * 60 * 1000

export const appShellSrc = (srcs: readonly string[]): string =>
	srcs.find(src => src.includes('/assets/')) ?? ''

const moduleScriptPath = (html: string): string | null => {
	const tags = html.match(/<script\b[^>]*>/gi) ?? []
	for (const tag of tags) {
		if (!/\btype\s*=\s*["']module["']/i.test(tag)) continue
		const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)
		if (src?.[1].includes('/assets/')) return src[1]
	}
	return null
}

const pathname = (src: string): string => {
	if (src.startsWith('/')) return src.split('?')[0]
	try {
		return new URL(src).pathname
	} catch {
		return src
	}
}

export const nextShellScript = (
	currentSrc: string,
	html: string,
): string | null => {
	const next = moduleScriptPath(html)
	if (!currentSrc || !next) return null
	const nextPath = pathname(next)
	if (pathname(currentSrc) === nextPath) return null
	return nextPath
}

export const shellReloadBlocked = (
	stored: string | null,
	nextPath: string,
	now: number,
): boolean => {
	if (!stored) return false
	const splitAt = stored.lastIndexOf('|')
	if (splitAt < 0) return false
	const path = stored.slice(0, splitAt)
	const at = Number(stored.slice(splitAt + 1))
	return path === nextPath && Number.isFinite(at) && now - at < SHELL_RELOAD_MS
}

export const reloadIfNewShell = (nextPath: string): void => {
	const now = Date.now()
	// note: a reload that stays on the old document retries after 10 minutes, not on the next focus.
	if (
		shellReloadBlocked(sessionStorage.getItem(SHELL_RELOAD_KEY), nextPath, now)
	) {
		return
	}
	sessionStorage.setItem(SHELL_RELOAD_KEY, `${nextPath}|${now}`)
	window.location.reload()
}
