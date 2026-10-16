import { describe, expect, it } from 'vitest'

import { aggregateInventoryByProductId } from '../shared/inventoryCost'

describe('aggregateInventoryByProductId', () => {
	it('keeps identity for a single warehouse row', () => {
		const row = {
			inventoryId: 'inv-a',
			productId: 'p1',
			warehouseId: 'w1',
			shelfId: 's1',
			quantity: 10,
			availableQuantity: 9,
			reservedQuantity: 1,
			averageCost: 2,
		}

		expect(aggregateInventoryByProductId([row]).get('p1')).toEqual(row)
	})

	it('blanks identity and sums qty when two warehouse rows merge', () => {
		const merged = aggregateInventoryByProductId([
			{
				_id: 'mongo-a',
				inventoryId: 'inv-a',
				productId: 'p1',
				warehouseId: 'w1',
				quantity: 10,
				availableQuantity: 10,
				reservedQuantity: 0,
				averageCost: 2,
			},
			{
				_id: 'mongo-b',
				inventoryId: 'inv-b',
				productId: 'p1',
				warehouseId: 'w2',
				quantity: 3,
				availableQuantity: 3,
				reservedQuantity: 0,
				averageCost: 4,
			},
		]).get('p1')

		expect(merged).toMatchObject({
			_id: undefined,
			inventoryId: '',
			warehouseId: '',
			shelfId: undefined,
			quantity: 13,
			availableQuantity: 13,
		})

		expect(merged?.averageCost).toBeCloseTo((2 * 10 + 4 * 3) / 13)
	})
})
