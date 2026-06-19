import type { SystemStyleObject } from '@chakra-ui/react'

/** Shared layout tokens for responsive mobile-first spacing. */
export const layout = {
	topBarHeight: { base: '4rem', md: '5rem' },
	contentPaddingX: { base: 4, md: 8 },
	contentPaddingY: { base: 4, md: 8 },
	logoSize: { base: '2rem', md: '2.875rem' },
} as const

export const layoutCssVars = {
	'--layout-topbar-height': layout.topBarHeight,
	'--layout-content-px': { base: '1rem', md: '2rem' },
	'--layout-content-py': { base: '1rem', md: '2rem' },
} satisfies Record<string, SystemStyleObject>

/** Height for mobile virtualized lists below page chrome (top bar + padding + headers). */
export const mobileVirtuosoStyle = {
	height:
		'calc(100dvh - var(--layout-topbar-height, 4rem) - 2 * var(--layout-content-py, 1rem) - 14rem)',
	width: '100%',
	minHeight: '12rem',
} as const

export const pageContentMinHeight = {
	base: 'calc(100dvh - var(--layout-topbar-height, 4rem) - 2 * var(--layout-content-py, 1rem))',
	md: 'calc(100dvh - var(--layout-topbar-height, 5rem) - 2 * var(--layout-content-py, 2rem))',
} as const
