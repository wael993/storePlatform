import { describe, expect, it } from 'vitest'

import { isLowStock } from '../shared/inventoryCost'

describe('isLowStock', () => {
	it('alerts at or under a positive minimum, and treats a missing quantity as 0', () => {
		expect(isLowStock(10, 10)).toBe(true)
		expect(isLowStock(7, 10)).toBe(true)
		expect(isLowStock(11, 10)).toBe(false)
		expect(isLowStock(undefined, 5)).toBe(true)
		expect(isLowStock(null, 5)).toBe(true)
		expect(isLowStock(0, 0)).toBe(false)
		expect(isLowStock(3, undefined)).toBe(false)
		expect(isLowStock(3, null)).toBe(false)
	})
})
