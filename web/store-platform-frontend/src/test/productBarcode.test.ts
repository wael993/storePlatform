import { describe, expect, it } from 'vitest'

import {
	allBarcodes,
	barcodeSetsEqual,
	displayProductBarcode,
	normalizeProductBarcodes,
} from '../shared/productBarcode'
import { withNoValueFallback } from '../shared/utils'
import {
	buildProductSearchIndexes,
	searchProducts,
} from '../components/SellingInvoice/productSearch'

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

describe('allBarcodes', () => {
	it('normalizes, promotes primary, and matches search on every code', () => {
		expect(normalizeProductBarcodes('prod-1', '', ['456', '789'])).toEqual({
			barcode: '456',
			additionalBarcodes: ['789'],
		})

		expect(
			allBarcodes({
				productId: 'prod-1',
				barcode: 'ABC',
				additionalBarcodes: ['abc', '999'],
			}),
		).toEqual(['ABC', '999'])

		expect(
			barcodeSetsEqual(
				'prod-1',
				{ barcode: '1', additionalBarcodes: ['2', '3'] },
				{ barcode: '3', additionalBarcodes: ['1', '2'] },
			),
		).toBe(true)

		const product = {
			productId: 'prod-1',
			name: 'Milk',
			barcode: '111',
			additionalBarcodes: ['222', '333'],
			price: { retailPrice: 1, currency: 'USD' },
			status: 'active' as const,
		}
		const products = [product]
		const indexes = buildProductSearchIndexes(products)

		expect(searchProducts(products, '222', 10, indexes)[0]?.productId).toBe(
			'prod-1',
		)
		expect(searchProducts(products, '333', 10, indexes)[0]?.productId).toBe(
			'prod-1',
		)
	})
})
