import { describe, expect, it } from 'vitest'

import { PricingLabelsType } from '../shared/globalEnums'
import {
	hasSellingCatalogPrice,
	pickSellingCatalogPrice,
	sellingCatalogPriceField,
} from '../components/SellingInvoice/productLineItem'

describe('sellingCatalogPriceField', () => {
	it('maps pricing label to the catalog price field to persist', () => {
		expect(sellingCatalogPriceField()).toBe('retailPrice')
		expect(sellingCatalogPriceField(PricingLabelsType.RETAIL_PRICE)).toBe(
			'retailPrice',
		)
		expect(sellingCatalogPriceField(PricingLabelsType.WHOLESALE_PRICE)).toBe(
			'wholesalePrice',
		)
		expect(
			sellingCatalogPriceField(PricingLabelsType.SEMI_WHOLESALE_PRICE),
		).toBe('semiWholesalePrice')
	})
})

describe('hasSellingCatalogPrice', () => {
	it('is false when wholesale/semi is missing even if retail exists', () => {
		const price = { retailPrice: 100, currency: 'USD' }
		expect(
			hasSellingCatalogPrice(price, PricingLabelsType.WHOLESALE_PRICE),
		).toBe(false)
		expect(
			hasSellingCatalogPrice(price, PricingLabelsType.SEMI_WHOLESALE_PRICE),
		).toBe(false)
		expect(hasSellingCatalogPrice(price, PricingLabelsType.RETAIL_PRICE)).toBe(
			true,
		)
	})

	it('is true when the labeled field is set (including 0)', () => {
		expect(
			hasSellingCatalogPrice(
				{ retailPrice: 100, wholesalePrice: 0, currency: 'USD' },
				PricingLabelsType.WHOLESALE_PRICE,
			),
		).toBe(true)
	})
})

describe('pickSellingCatalogPrice', () => {
	const price = {
		retailPrice: 100,
		wholesalePrice: 80,
		semiWholesalePrice: 90,
		currency: 'USD',
	}

	it('uses retail by default', () => {
		expect(pickSellingCatalogPrice(price)).toBe(100)
		expect(pickSellingCatalogPrice(price, PricingLabelsType.RETAIL_PRICE)).toBe(
			100,
		)
	})

	it('uses wholesale when labeled wholesale', () => {
		expect(
			pickSellingCatalogPrice(price, PricingLabelsType.WHOLESALE_PRICE),
		).toBe(80)
	})

	it('uses semi-wholesale when labeled semi-wholesale', () => {
		expect(
			pickSellingCatalogPrice(price, PricingLabelsType.SEMI_WHOLESALE_PRICE),
		).toBe(90)
	})

	it('falls back to retail when wholesale/semi is missing', () => {
		expect(
			pickSellingCatalogPrice(
				{ retailPrice: 100, currency: 'USD' },
				PricingLabelsType.WHOLESALE_PRICE,
			),
		).toBe(100)
		expect(
			pickSellingCatalogPrice(
				{ retailPrice: 100, currency: 'USD' },
				PricingLabelsType.SEMI_WHOLESALE_PRICE,
			),
		).toBe(100)
	})
})
