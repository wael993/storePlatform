import { describe, expect, it } from 'vitest'

import {
	assertProductNameMaxLength,
	mergeProductPricePatch,
	normalizeProductPatchRequest,
} from '../apis/productHelper/productPatchNormalize'

describe('mergeProductPricePatch', () => {
	const existing = {
		purchasePrice: 100,
		retailPrice: 150,
		currency: 'USD',
	}

	it('keeps retailPrice when only purchasePrice is patched', () => {
		const merged = mergeProductPricePatch(existing, { purchasePrice: 10 })

		expect(merged.purchasePrice).toBe(10)
		expect(merged.retailPrice).toBe(150)
		expect(merged.currency).toBe('USD')
	})

	it('keeps purchasePrice when only retailPrice is patched', () => {
		expect(
			mergeProductPricePatch(existing, { retailPrice: 15 }).purchasePrice,
		).toBe(100)

		expect(
			mergeProductPricePatch(existing, { retailPrice: 15 }).retailPrice,
		).toBe(15)
	})

	it('applies rapid sequential single-field edits without restoring stale prices', () => {
		const afterBuy = mergeProductPricePatch(existing, { purchasePrice: 10 })
		const afterSell = mergeProductPricePatch(afterBuy, { retailPrice: 15 })

		expect(afterSell.purchasePrice).toBe(10)
		expect(afterSell.retailPrice).toBe(15)
	})
})

describe('product name length', () => {
	it('rejects names and latin names longer than 100 characters', () => {
		expect(() =>
			normalizeProductPatchRequest({ name: 'n'.repeat(101) }),
		).toThrow(/Invalid value for name/)

		expect(() =>
			normalizeProductPatchRequest({ latinName: 'n'.repeat(101) }),
		).toThrow(/Invalid value for latinName/)

		expect(() => assertProductNameMaxLength('n'.repeat(101), 'name')).toThrow(
			/Invalid value for name/,
		)
	})
})

describe('product status', () => {
	it('accepts active and inactive and rejects discontinued', () => {
		expect(normalizeProductPatchRequest({ status: 'active' }).status).toBe(
			'active',
		)
		expect(normalizeProductPatchRequest({ status: 'inactive' }).status).toBe(
			'inactive',
		)
		expect(() =>
			normalizeProductPatchRequest({
				status: 'discontinued',
			} as Parameters<typeof normalizeProductPatchRequest>[0]),
		).toThrow(/Invalid value for status/)
	})
})
