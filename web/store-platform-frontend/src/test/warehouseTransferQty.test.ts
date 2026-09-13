import { describe, expect, it } from 'vitest'

import {
	isTransferQtyValid,
	parseTransferQty,
} from '../components/product/warehouseTransferQty'

describe('isTransferQtyValid', () => {
	it('accepts an integer in stock and rejects empty, zero, and oversold', () => {
		expect(isTransferQtyValid(parseTransferQty('1'), 5)).toBe(true)
		expect(isTransferQtyValid(parseTransferQty(''), 5)).toBe(false)
		expect(isTransferQtyValid(parseTransferQty('0'), 5)).toBe(false)
		expect(isTransferQtyValid(parseTransferQty('6'), 5)).toBe(false)
	})
})
