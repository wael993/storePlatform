import { describe, expect, it } from 'vitest'

import { buildProductInlinePatch } from '../components/product/productInlineEdit'

const product: Product = {
	productId: 'coke',
	name: 'Coca Cola',
	barcode: '123',
	price: {
		purchasePrice: 100,
		retailPrice: 150,
		currency: 'USD',
	},
	status: 'active',
	inventory: {
		inventoryId: 'inv1',
		productId: 'coke',
		warehouseId: 'wh1',
		quantity: 10,
	},
}

describe('buildProductInlinePatch', () => {
	it('sends only purchasePrice for a buying-price edit', () => {
		const patch = buildProductInlinePatch(product, 'purchasePrice', '10')

		expect(patch).toEqual({
			persist: 'product',
			body: { price: { purchasePrice: 10 } },
		})
	})

	it('sends only retailPrice for a selling-price edit', () => {
		const patch = buildProductInlinePatch(product, 'retailPrice', '15')

		expect(patch).toEqual({
			persist: 'product',
			body: { price: { retailPrice: 15 } },
		})
	})

	it('does not include the stale sibling price from row props', () => {
		const buy = buildProductInlinePatch(product, 'purchasePrice', '10')
		const sell = buildProductInlinePatch(product, 'retailPrice', '15')

		expect(buy).toMatchObject({ persist: 'product' })
		expect(sell).toMatchObject({ persist: 'product' })

		if (buy.persist !== 'product' || sell.persist !== 'product') {
			throw new Error('expected product patches')
		}

		expect(buy.body.price).not.toHaveProperty('retailPrice')
		expect(sell.body.price).not.toHaveProperty('purchasePrice')
		expect(buy.body.price).toEqual({ purchasePrice: 10 })
		expect(sell.body.price).toEqual({ retailPrice: 15 })
	})
})
