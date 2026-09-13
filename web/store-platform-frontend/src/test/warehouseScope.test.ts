import { afterEach, describe, expect, it } from 'vitest'

import {
	requireOperationalWarehouseId,
	setWarehouseScopeIds,
	toWarehouseScopeHeader,
} from '../shared/warehouseScope'

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

describe('requireOperationalWarehouseId', () => {
	afterEach(() => {
		setWarehouseScopeIds([])
	})

	it('uses the operational warehouse when the body omits one', () => {
		setWarehouseScopeIds(['w1'])
		expect(requireOperationalWarehouseId()).toBe('w1')
		expect(requireOperationalWarehouseId('w1')).toBe('w1')
		expect(() => requireOperationalWarehouseId('w2')).toThrow()

		setWarehouseScopeIds(['w1', 'w2'])
		expect(() => requireOperationalWarehouseId()).toThrow()
		expect(() => requireOperationalWarehouseId('w1')).toThrow()

		setWarehouseScopeIds([])
		expect(() => requireOperationalWarehouseId()).toThrow()
		expect(() => requireOperationalWarehouseId('w1')).toThrow()
	})
})
