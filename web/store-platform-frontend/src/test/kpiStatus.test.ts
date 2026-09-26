import { describe, expect, it } from 'vitest'
import { KPI_STATUSES, resolveKpiChrome } from '../shared/kpiStatus'

describe('kpiStatus', () => {
	it('maps every KPI status to the correct chrome', () => {
		expect([...KPI_STATUSES]).toEqual([
			'coming_soon',
			'available',
			'unavailable',
			'loading',
			'error',
		])
		expect(resolveKpiChrome('available')).toEqual({ kind: 'children' })
		expect(resolveKpiChrome('loading')).toEqual({ kind: 'loading' })
		expect(resolveKpiChrome('coming_soon')).toEqual({
			kind: 'message',
			message: 'coming_soon',
		})
		expect(resolveKpiChrome('unavailable')).toEqual({
			kind: 'message',
			message: 'unavailable',
		})
		expect(resolveKpiChrome('error')).toEqual({
			kind: 'message',
			message: 'error',
		})
	})
})
