import { describe, expect, it } from 'vitest'

import {
	MIN_NAME_TOKEN_LENGTH,
	searchProducts,
	type SearchableProduct,
} from '../shared/productSearch'

const catalog: SearchableProduct[] = [
	{
		name: 'Red Apple Juice',
		latinName: 'Malus',
		barcode: '123456',
		internalCode: 'APL-1',
		productId: 'p-apple',
	},
	{
		name: 'Green Tea',
		barcode: '654321',
		internalCode: 'TEA-9',
		productId: 'p-tea',
	},
	{
		name: 'Red Apple Jam',
		barcode: '123457',
		productId: 'p-jam',
	},
]

describe('searchProducts', () => {
	it('returns nothing for an empty query', () => {
		expect(searchProducts(catalog, '')).toEqual([])
		expect(searchProducts(catalog, '   ')).toEqual([])
	})

	it('matches an exact barcode or internal code first', () => {
		expect(searchProducts(catalog, '123456')).toEqual([catalog[0]])
		expect(searchProducts(catalog, 'APL-1')).toEqual([catalog[0]])
	})

	it('matches name tokens across words', () => {
		expect(searchProducts(catalog, 'red apple')).toEqual([
			catalog[0],
			catalog[2],
		])
	})

	it('ignores name matches for a single short token', () => {
		expect(MIN_NAME_TOKEN_LENGTH).toBe(2)
		expect(searchProducts(catalog, 'R')).toEqual([])
	})

	it('returns nothing when a multi-word query has a short token', () => {
		expect(searchProducts(catalog, 'red a')).toEqual([])
	})

	it('respects the result limit', () => {
		expect(searchProducts(catalog, 'red apple', 1)).toEqual([catalog[0]])
	})
})
