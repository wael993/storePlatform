import { describe, expect, it } from 'vitest'
import {
	appShellSrc,
	nextShellScript,
	shellReloadBlocked,
} from '../shared/shellUpdate'

const html = (src: string) =>
	`<!DOCTYPE html><html><head><script type="module" crossorigin src="${src}"></script></head></html>`

describe('nextShellScript', () => {
	it('ignores the same module when the running src is absolute', () => {
		expect(
			nextShellScript(
				'https://app.example/assets/index-abc.js',
				html('/assets/index-abc.js'),
			),
		).toBeNull()
	})

	it('returns the new module path when the build hash changes', () => {
		expect(
			nextShellScript('/assets/index-old.js', html('/assets/index-new.js')),
		).toBe('/assets/index-new.js')
	})

	it('uses the module script and skips other script tags', () => {
		expect(
			nextShellScript(
				'/assets/index-old.js',
				'<script src="/legacy.js"></script><script src="/assets/index-new.js" type="module"></script>',
			),
		).toBe('/assets/index-new.js')
	})

	it('stays on the running build when the document has no module script', () => {
		expect(nextShellScript('/assets/index-old.js', '<html></html>')).toBeNull()
	})

	it('ignores a module script outside /assets/', () => {
		expect(
			nextShellScript(
				'/assets/index-old.js',
				'<script type="module" src="/extension.js"></script><script type="module" src="/assets/index-new.js"></script>',
			),
		).toBe('/assets/index-new.js')
		expect(appShellSrc(['/extension.js', '/assets/index-abc.js'])).toBe(
			'/assets/index-abc.js',
		)
		expect(appShellSrc(['/extension.js'])).toBe('')
	})
})

describe('shellReloadBlocked', () => {
	it('blocks a repeat for 10 minutes and then allows another try', () => {
		const stored = '/assets/index-new.js|1000'
		expect(
			shellReloadBlocked(stored, '/assets/index-new.js', 1000 + 60_000),
		).toBe(true)
		expect(
			shellReloadBlocked(stored, '/assets/index-new.js', 1000 + 10 * 60 * 1000),
		).toBe(false)
		expect(shellReloadBlocked(stored, '/assets/index-other.js', 1000)).toBe(
			false,
		)
		expect(shellReloadBlocked(null, '/assets/index-new.js', 1000)).toBe(false)
	})
})
