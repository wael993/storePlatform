import { describe, expect, it } from 'vitest'

import { findOversellLines } from 'store-domain'

const coke = { productId: 'coke', name: 'Coca Cola', quantity: 10 }

describe('findOversellLines', () => {
	it('blocks oversell only when the tenant setting is off', () => {
		const available = new Map([['coke', 4]])

		expect(findOversellLines([coke], available, true)).toEqual([])
		expect(findOversellLines([coke], available, false)).toEqual([
			{
				productId: 'coke',
				name: 'Coca Cola',
				requested: 10,
				available: 4,
			},
		])
		expect(
			findOversellLines([{ ...coke, quantity: 4 }], available, false),
		).toEqual([])
		expect(findOversellLines([coke], new Map(), false)).toEqual([])
		expect(findOversellLines([coke], new Map([['coke', 0]]), false)).toEqual([
			{
				productId: 'coke',
				name: 'Coca Cola',
				requested: 10,
				available: 0,
			},
		])
	})
})
