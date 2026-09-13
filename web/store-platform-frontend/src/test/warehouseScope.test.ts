import { describe, expect, it } from 'vitest'

import { toWarehouseScopeHeader } from '../shared/warehouseScope'

describe('toWarehouseScopeHeader', () => {
	it('encodes Arabic warehouse ids so Headers.set accepts them', () => {
		expect(() => new Headers().set('x-warehouse-scope', 'المستودع')).toThrow()

		expect(() =>
			new Headers().set(
				'x-warehouse-scope',
				toWarehouseScopeHeader(['المستودع']),
			),
		).not.toThrow()
	})
})
