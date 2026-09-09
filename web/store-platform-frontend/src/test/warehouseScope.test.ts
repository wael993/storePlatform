import { describe, expect, it } from 'vitest'

import { filterByAllowedProductIds } from '../shared/warehouseScopeFilter'

describe('filterByAllowedProductIds', () => {
	const products = [
		{ productId: 'a', name: 'A' },
		{ productId: 'b', name: 'B' },
		{ name: 'missing-id' },
		{ productId: '', name: 'empty-id' },
	]

	it('returns all products when no warehouse is selected', () => {
		expect(filterByAllowedProductIds(products, null)).toEqual(products)
	})

	it('returns an empty list only when a warehouse is selected and none match', () => {
		expect(filterByAllowedProductIds(products, [])).toEqual([])
	})

	it('keeps products whose id is in the selected warehouse stock set', () => {
		expect(filterByAllowedProductIds(products, ['b', 'missing'])).toEqual([
			{ productId: 'b', name: 'B' },
		])
	})
})
