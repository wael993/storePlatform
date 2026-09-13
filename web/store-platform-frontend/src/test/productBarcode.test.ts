import { describe, expect, it } from 'vitest'

import { displayProductBarcode } from '../shared/productBarcode'
import { withNoValueFallback } from '../shared/utils'

describe('displayProductBarcode', () => {
	it('does not render the product id when barcode is missing or a legacy placeholder', () => {
		expect(displayProductBarcode({ productId: 'prod-1', barcode: '' })).toBe('')
		expect(
			displayProductBarcode({ productId: 'prod-1', barcode: undefined }),
		).toBe('')
		expect(
			displayProductBarcode({ productId: 'prod-1', barcode: 'prod-1' }),
		).toBe('')
		expect(
			displayProductBarcode({ productId: 'prod-1', barcode: '001070002' }),
		).toBe('001070002')
	})

	it('list cells show a placeholder or the real barcode, never the product id', () => {
		const empty = withNoValueFallback(
			displayProductBarcode({ productId: 'prod-1', barcode: '' }),
		)
		const legacy = withNoValueFallback(
			displayProductBarcode({ productId: 'prod-1', barcode: 'prod-1' }),
		)
		const generated = withNoValueFallback(
			displayProductBarcode({ productId: 'prod-1', barcode: 'Babc123' }),
		)

		expect(empty).toBe('-')
		expect(legacy).toBe('-')
		expect(generated).toBe('Babc123')
		expect(empty).not.toBe('prod-1')
		expect(legacy).not.toBe('prod-1')
	})
})
