import { describe, expect, it } from 'vitest'

import { mergeProductIntoCatalogItem } from '../components/SellingInvoice/catalogMappers'
import { outboxIdempotencyKey } from '../offline/localStore'
import {
	availableQuantityFromStock,
	persistableLocalBarcode,
} from '../offline/localProductInventoryMutations'

const product = (overrides: Partial<Product> = {}): Product => ({
	productId: 'coke',
	name: 'Coca Cola',
	barcode: '123',
	price: {
		purchasePrice: 10,
		retailPrice: 15,
		discount: 5,
		currency: 'USD',
	},
	status: 'active',
	...overrides,
})

describe('outboxIdempotencyKey', () => {
	it('keeps invoice creates keyed by identity, not body', () => {
		expect(
			outboxIdempotencyKey('selling-invoices', 'POST', {
				invoiceId: 'inv-1',
				notes: 'first',
			}),
		).toBe(
			outboxIdempotencyKey('selling-invoices', 'POST', {
				invoiceId: 'inv-1',
				notes: 'second',
			}),
		)
	})

	it('does not collapse sequential product PATCHes with different bodies', () => {
		const nameKey = outboxIdempotencyKey('products/coke', 'PATCH', {
			name: 'A',
		})
		const barcodeKey = outboxIdempotencyKey('products/coke', 'PATCH', {
			barcode: '123',
		})
		const price10 = outboxIdempotencyKey('products/coke', 'PATCH', {
			price: { purchasePrice: 10 },
		})
		const price15 = outboxIdempotencyKey('products/coke', 'PATCH', {
			price: { purchasePrice: 15 },
		})

		expect(nameKey).not.toBe(barcodeKey)
		expect(price10).not.toBe(price15)
		expect(price10).toBe(
			outboxIdempotencyKey('products/coke', 'PATCH', {
				price: { purchasePrice: 10 },
			}),
		)
	})

	it('does not collapse sequential inventory PATCHes for the same warehouse', () => {
		expect(
			outboxIdempotencyKey('inventory/by-product/coke', 'PATCH', {
				warehouseId: 'wh1',
				quantity: 10,
			}),
		).not.toBe(
			outboxIdempotencyKey('inventory/by-product/coke', 'PATCH', {
				warehouseId: 'wh1',
				quantity: 5,
			}),
		)
	})
})

describe('persistableLocalBarcode', () => {
	it('stores empty when the barcode is missing or the product id', () => {
		expect(persistableLocalBarcode('coke', 'coke')).toBe('')
		expect(persistableLocalBarcode('coke', '   ')).toBe('')
		expect(persistableLocalBarcode('coke', '001070002')).toBe('001070002')
	})
})

describe('availableQuantityFromStock', () => {
	it('keeps available stock in lockstep with quantity and reserved', () => {
		expect(availableQuantityFromStock(10)).toBe(10)
		expect(availableQuantityFromStock(10, 3)).toBe(7)
		expect(availableQuantityFromStock(1, 5)).toBe(0)
	})
})

describe('mergeProductIntoCatalogItem', () => {
	const existing = mergeProductIntoCatalogItem(undefined, product(), {
		seeBuying: true,
		averageCost: 8,
	})

	it('updates identity and price without dropping invoice-derived fields', () => {
		const existingWithHistory = {
			...existing,
			lastSellingPrice: 20,
			lastBuyingPrice: 9,
			images: ['old.png'],
		}

		const merged = mergeProductIntoCatalogItem(
			existingWithHistory,
			product({
				name: 'Diet Coke',
				barcode: '999',
				price: {
					retailPrice: 18,
					purchasePrice: 12,
					discount: 0,
					currency: 'USD',
				},
			}),
			{ seeBuying: true, averageCost: 12 },
		)

		expect(merged.name).toBe('Diet Coke')
		expect(merged.barcode).toBe('999')
		expect(merged.price.retailPrice).toBe(18)
		expect(merged.price.purchasePrice).toBe(12)
		expect(merged.averageCost).toBe(12)
		expect(merged.lastSellingPrice).toBe(20)
		expect(merged.lastBuyingPrice).toBe(9)
		expect(merged.images).toEqual(['old.png'])
	})

	it('strips buying-cost fields when the caller cannot see them', () => {
		const merged = mergeProductIntoCatalogItem(
			{
				...existing,
				price: { ...existing.price, purchasePrice: 10 },
				averageCost: 8,
				lastBuyingPrice: 9,
			},
			product(),
			{ seeBuying: false, averageCost: 8 },
		)

		expect(merged.price.purchasePrice).toBeUndefined()
		expect(merged.averageCost).toBeUndefined()
		expect(merged.lastBuyingPrice).toBeUndefined()
		expect(merged.price.retailPrice).toBe(15)
	})
})
