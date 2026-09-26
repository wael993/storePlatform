export const KPI_STATUSES = [
	'coming_soon',
	'available',
	'unavailable',
	'loading',
	'error',
] as const

export type KpiStatus = (typeof KPI_STATUSES)[number]

export type KpiMessageKind = 'coming_soon' | 'unavailable' | 'error'

export type KpiChromeResolved =
	| { kind: 'children' }
	| { kind: 'loading' }
	| { kind: 'message'; message: KpiMessageKind }

export const resolveKpiChrome = (status: KpiStatus): KpiChromeResolved => {
	if (status === 'available') return { kind: 'children' }
	if (status === 'loading') return { kind: 'loading' }
	if (status === 'coming_soon')
		return { kind: 'message', message: 'coming_soon' }
	if (status === 'unavailable')
		return { kind: 'message', message: 'unavailable' }
	return { kind: 'message', message: 'error' }
}
