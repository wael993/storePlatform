import { describe, expect, it } from 'vitest'

import { parseBulkEditProductsBody } from '../apis/productHelper/productBulkEdit'

describe('parseBulkEditProductsBody', () => {
	it('accepts partial product fields and omits empties', () => {
		const parsed = parseBulkEditProductsBody({
			productIds: ['a', 'a', 'b', ''],
			categoryId: 'cat-1',
			supplierId: '  ',
			discount: 10,
			unitId: '',
		})

		expect(parsed.productIds).toEqual(['a', 'b'])
		expect(parsed.productPatch).toEqual({
			categoryId: 'cat-1',
			price: { discount: 10 },
		})

		expect(parsed.minQuantity).toBeUndefined()
	})

	it('requires warehouseId when minQuantity is set', () => {
		expect(() =>
			parseBulkEditProductsBody({
				productIds: ['a'],
				minQuantity: 3,
			}),
		).toThrow(/warehouseId is required/)

		const parsed = parseBulkEditProductsBody({
			productIds: ['a'],
			minQuantity: 3,
			warehouseId: 'wh-1',
		})

		expect(parsed.minQuantity).toBe(3)
		expect(parsed.warehouseId).toBe('wh-1')
		expect(parsed.productPatch).toBeNull()
	})

	it('rejects empty productIds or empty patch', () => {
		expect(() => parseBulkEditProductsBody({ productIds: [] })).toThrow(
			/productIds is required/,
		)

		expect(() =>
			parseBulkEditProductsBody({ productIds: ['a'], categoryId: '' }),
		).toThrow(/No valid fields/)
	})
})
