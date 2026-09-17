import { describe, expect, it } from 'vitest'

import {
	establishedWarehouseIdsFromMovings,
	isEstablishedCostMovingType,
	mergeQtyWeightedAverageCost,
	openingAverageCostFromPurchasePrice,
	shouldReplaceOpeningAverageCost,
} from '../shared/inventoryCost'
import {
	allocateNetLineRevenues,
	buildPeriodProductAggregates,
	invoiceLineRevenue,
	mergeInvoiceItemsPreservingUnitCost,
	originalSaleUnitCostByProduct,
	pickBestSellerSummaryProduct,
	pickTopProfitSummaryProduct,
	selectCurrentSaleMovings,
	totalProfitFromAggregates,
} from '../shared/sellingInvoiceProfit'

describe('opening inventory cost', () => {
	it('seeds averageCost from the catalog purchase price', () => {
		expect(openingAverageCostFromPurchasePrice(100)).toBe(100)
		expect(openingAverageCostFromPurchasePrice('10')).toBe(10)
		expect(openingAverageCostFromPurchasePrice(undefined)).toBeUndefined()
		expect(openingAverageCostFromPurchasePrice(Number.NaN)).toBeUndefined()
		expect(openingAverageCostFromPurchasePrice('')).toBeUndefined()
		expect(openingAverageCostFromPurchasePrice('   ')).toBeUndefined()
	})

	it('does not treat missing warehouse cost as zero in the WAC mix', () => {
		expect(mergeQtyWeightedAverageCost(10, 5, undefined, 5)).toBe(10)
		expect(
			mergeQtyWeightedAverageCost(
				mergeQtyWeightedAverageCost(10, 5, undefined, 5),
				5,
				8,
				5,
			),
		).toBe(9)
	})

	it('skips invalid costs instead of treating them as zero', () => {
		expect(mergeQtyWeightedAverageCost('10', 5, 'nope', 5)).toBe(10)
		expect(mergeQtyWeightedAverageCost(Number.NaN, 5, 8, 5)).toBe(8)
		expect(
			mergeQtyWeightedAverageCost(10, 5, Number.POSITIVE_INFINITY, 5),
		).toBe(10)

		expect(mergeQtyWeightedAverageCost(null, 5, undefined, 5)).toBeUndefined()
	})

	it('treats purchase and transfer_in as established WAC per warehouse', () => {
		expect(isEstablishedCostMovingType('purchase')).toBe(true)
		expect(isEstablishedCostMovingType('transfer_in')).toBe(true)
		expect(isEstablishedCostMovingType('sale')).toBe(false)

		const established = establishedWarehouseIdsFromMovings([
			{ type: 'purchase', warehouseId: 'wh-a' },
			{ type: 'transfer_in', warehouseId: 'wh-c' },
			{ type: 'sale', warehouseId: 'wh-b' },
		])

		expect(shouldReplaceOpeningAverageCost('wh-b', established)).toBe(true)
		expect(shouldReplaceOpeningAverageCost('wh-a', established)).toBe(false)
		expect(shouldReplaceOpeningAverageCost('wh-c', established)).toBe(false)
	})

	it('does not lock a warehouse after its buying invoice is cancelled', () => {
		const established = establishedWarehouseIdsFromMovings([
			{
				type: 'purchase',
				warehouseId: 'wh-a',
				referenceId: 'bi-1',
				referenceType: 'buying_invoice',
			},
			{
				type: 'return_out',
				warehouseId: 'wh-a',
				referenceId: 'bi-1',
				referenceType: 'buying_invoice',
			},
		])

		expect(shouldReplaceOpeningAverageCost('wh-a', established)).toBe(true)
	})

	it('keeps WAC locked when a later purchase remains after a cancelled one', () => {
		const established = establishedWarehouseIdsFromMovings([
			{
				type: 'purchase',
				warehouseId: 'wh-a',
				referenceId: 'bi-1',
				referenceType: 'buying_invoice',
			},
			{
				type: 'return_out',
				warehouseId: 'wh-a',
				referenceId: 'bi-1',
				referenceType: 'buying_invoice',
			},
			{
				type: 'purchase',
				warehouseId: 'wh-a',
				referenceId: 'bi-2',
				referenceType: 'buying_invoice',
			},
		])

		expect(shouldReplaceOpeningAverageCost('wh-a', established)).toBe(false)
	})
})

describe('sale unit-cost snapshot', () => {
	it('keeps the oldest sale unitCost per product for reversals', () => {
		const costs = originalSaleUnitCostByProduct([
			{
				type: 'sale',
				productId: 'coke',
				unitCost: 12,
				createdAt: '2026-09-16T12:00:00.000Z',
			},
			{
				type: 'sale',
				productId: 'coke',
				unitCost: 10,
				createdAt: '2026-09-16T10:00:00.000Z',
			},
			{
				type: 'return_in',
				productId: 'coke',
				unitCost: 99,
				createdAt: '2026-09-16T11:00:00.000Z',
			},
		])

		expect(costs.get('coke')).toBe(10)
	})

	it('skips a missing unitCost instead of freezing 0', () => {
		const costs = originalSaleUnitCostByProduct([
			{
				type: 'sale',
				productId: 'coke',
				createdAt: '2026-09-16T10:00:00.000Z',
			},
			{
				type: 'sale',
				productId: 'coke',
				unitCost: 10,
				createdAt: '2026-09-16T12:00:00.000Z',
			},
		])

		expect(costs.has('coke')).toBe(true)
		expect(costs.get('coke')).toBe(10)
	})

	it('keeps a real zero snapshot', () => {
		const costs = originalSaleUnitCostByProduct([
			{
				type: 'sale',
				productId: 'coke',
				unitCost: 0,
				createdAt: '2026-09-16T10:00:00.000Z',
			},
			{
				type: 'sale',
				productId: 'coke',
				unitCost: 10,
				createdAt: '2026-09-16T12:00:00.000Z',
			},
		])

		expect(costs.get('coke')).toBe(0)
	})
})

describe('net revenue and profit', () => {
	it('uses lineTotal when present, else qty * unitPrice', () => {
		expect(
			invoiceLineRevenue({ lineTotal: 15, quantity: 1, unitPrice: 99 }),
		).toBe(15)

		expect(invoiceLineRevenue({ quantity: 2, unitPrice: 15 })).toBe(30)
	})

	it('allocates a signed delta so net revenue matches grandTotal', () => {
		const [line] = allocateNetLineRevenues(
			[{ productId: 'coke', quantity: 1, lineTotal: 100 }],
			110,
		)

		expect(line.netRevenue).toBe(110)
	})

	it('extra-zero correction: sell 1 @ 15 with opening cost 10', () => {
		const { aggregates, profitReliable } = buildPeriodProductAggregates(
			[
				{
					grandTotal: 15,
					items: [
						{
							productId: 'coke',
							name: 'Coca Cola',
							quantity: 1,
							unitPrice: 15,
							lineTotal: 15,
						},
					],
				},
			],
			[{ type: 'sale', productId: 'coke', quantity: 1, unitCost: 10 }],
		)

		expect(profitReliable).toBe(true)
		expect(totalProfitFromAggregates(aggregates)).toBe(5)
		expect(aggregates.get('coke')?.cogs).toBe(10)
		expect(pickTopProfitSummaryProduct(aggregates)?.profit).toBe(5)
	})

	it('established WAC 10 is used even if catalog purchasePrice is 12', () => {
		const { aggregates } = buildPeriodProductAggregates(
			[
				{
					grandTotal: 15,
					items: [
						{
							productId: 'coke',
							quantity: 1,
							unitPrice: 15,
							lineTotal: 15,
						},
					],
				},
			],
			[{ type: 'sale', productId: 'coke', quantity: 1, unitCost: 10 }],
		)

		expect(aggregates.get('coke')?.cogs).toBe(10)
		expect(totalProfitFromAggregates(aggregates)).toBe(5)
	})

	it('invoice unitPrice change uses new revenue and original unitCost', () => {
		const { aggregates } = buildPeriodProductAggregates(
			[
				{
					grandTotal: 25,
					items: [
						{
							productId: 'coke',
							quantity: 1,
							unitPrice: 25,
							lineTotal: 25,
						},
					],
				},
			],
			[{ type: 'sale', productId: 'coke', quantity: 1, unitCost: 10 }],
		)

		expect(totalProfitFromAggregates(aggregates)).toBe(15)
	})

	it('does not double-count leftover sale movings when only one sale remains', () => {
		const { aggregates } = buildPeriodProductAggregates(
			[
				{
					grandTotal: 25,
					items: [
						{
							productId: 'coke',
							quantity: 1,
							unitPrice: 25,
							lineTotal: 25,
						},
					],
				},
			],
			[
				{ type: 'return_in', productId: 'coke', quantity: 1, unitCost: 10 },
				{ type: 'sale', productId: 'coke', quantity: 1, unitCost: 10 },
			],
		)

		expect(aggregates.get('coke')?.cogs).toBe(10)
		expect(totalProfitFromAggregates(aggregates)).toBe(15)
	})

	it('ignores leftover stacked sales when selecting current COGS', () => {
		const current = selectCurrentSaleMovings(
			[
				{
					invoiceId: 'si-1',
					items: [{ productId: 'coke', quantity: 1, lineTotal: 25 }],
				},
			],
			[
				{
					type: 'sale',
					productId: 'coke',
					referenceId: 'si-1',
					quantity: 1,
					unitCost: 10,
					createdAt: '2026-09-16T10:00:00.000Z',
				},
				{
					type: 'return_in',
					productId: 'coke',
					referenceId: 'si-1',
					quantity: 1,
					unitCost: 10,
					createdAt: '2026-09-16T11:00:00.000Z',
				},
				{
					type: 'sale',
					productId: 'coke',
					referenceId: 'si-1',
					quantity: 1,
					unitCost: 10,
					createdAt: '2026-09-16T12:00:00.000Z',
				},
			],
		)

		expect(current).toHaveLength(1)
		expect(current[0].createdAt).toBe('2026-09-16T12:00:00.000Z')

		const { aggregates } = buildPeriodProductAggregates(
			[
				{
					grandTotal: 25,
					items: [
						{
							productId: 'coke',
							quantity: 1,
							unitPrice: 25,
							lineTotal: 25,
						},
					],
				},
			],
			current,
		)

		expect(totalProfitFromAggregates(aggregates)).toBe(15)
	})

	it('caps leftover stacked sale qty to the current line', () => {
		const current = selectCurrentSaleMovings(
			[
				{
					invoiceId: 'si-1',
					items: [{ productId: 'coke', quantity: 1, lineTotal: 15 }],
				},
			],
			[
				{
					type: 'sale',
					productId: 'coke',
					referenceId: 'si-1',
					quantity: 5,
					unitCost: 10,
					createdAt: '2026-09-16T12:00:00.000Z',
				},
			],
		)

		expect(current[0].quantity).toBe(1)

		const { aggregates, profitReliable } = buildPeriodProductAggregates(
			[
				{
					grandTotal: 15,
					items: [{ productId: 'coke', quantity: 1, lineTotal: 15 }],
				},
			],
			current,
		)

		expect(profitReliable).toBe(true)
		expect(aggregates.get('coke')?.cogs).toBe(10)
		expect(totalProfitFromAggregates(aggregates)).toBe(5)
	})

	it('invoice discount reduces profit revenue to grandTotal', () => {
		const { aggregates } = buildPeriodProductAggregates(
			[
				{
					grandTotal: 90,
					items: [
						{
							productId: 'coke',
							name: 'Coca Cola',
							quantity: 1,
							lineTotal: 100,
						},
					],
				},
			],
			[{ type: 'sale', productId: 'coke', quantity: 1, unitCost: 60 }],
		)

		expect(aggregates.get('coke')?.revenue).toBe(90)
		expect(totalProfitFromAggregates(aggregates)).toBe(30)
	})

	it('splits invoice discount across products', () => {
		const { aggregates } = buildPeriodProductAggregates(
			[
				{
					grandTotal: 90,
					items: [
						{
							productId: 'a',
							name: 'A',
							quantity: 1,
							lineTotal: 60,
						},
						{
							productId: 'b',
							name: 'B',
							quantity: 1,
							lineTotal: 40,
						},
					],
				},
			],
			[
				{ type: 'sale', productId: 'a', quantity: 1, unitCost: 20 },
				{ type: 'sale', productId: 'b', quantity: 1, unitCost: 10 },
			],
		)

		expect(aggregates.get('a')?.revenue).toBe(54)
		expect(aggregates.get('b')?.revenue).toBe(36)
		expect(totalProfitFromAggregates(aggregates)).toBe(60)
		expect(pickBestSellerSummaryProduct(aggregates)?.productId).toBe('a')
	})

	it('marks profit unreliable when sale movings are missing', () => {
		const { aggregates, profitReliable } = buildPeriodProductAggregates(
			[
				{
					grandTotal: 15,
					items: [
						{
							productId: 'coke',
							quantity: 1,
							unitPrice: 15,
							lineTotal: 15,
						},
					],
				},
			],
			[],
		)

		expect(profitReliable).toBe(false)
		expect(aggregates.get('coke')?.cogs).toBe(0)
		expect(aggregates.get('coke')?.quantitySold).toBe(1)
		expect(pickBestSellerSummaryProduct(aggregates)?.productId).toBe('coke')
		expect(pickTopProfitSummaryProduct(aggregates)?.profit).toBe(15)
		expect(totalProfitFromAggregates(aggregates)).toBe(15)
	})

	it('marks profit unreliable when a sale moving has no unitCost', () => {
		const { aggregates, profitReliable } = buildPeriodProductAggregates(
			[
				{
					grandTotal: 15,
					items: [{ productId: 'coke', quantity: 1, lineTotal: 15 }],
				},
			],
			[{ type: 'sale', productId: 'coke', quantity: 1 }],
		)

		expect(profitReliable).toBe(false)
		expect(aggregates.get('coke')?.cogs).toBe(0)
		expect(totalProfitFromAggregates(aggregates)).toBe(15)
	})

	it('treats an empty period as reliable zero profit', () => {
		const { aggregates, profitReliable } = buildPeriodProductAggregates([], [])

		expect(profitReliable).toBe(true)
		expect(totalProfitFromAggregates(aggregates)).toBe(0)
		expect(pickBestSellerSummaryProduct(aggregates)).toBeNull()
		expect(pickTopProfitSummaryProduct(aggregates)).toBeNull()
	})

	it('keeps stamped unitCost when invoice items are replaced', () => {
		const merged = mergeInvoiceItemsPreservingUnitCost(
			[{ productId: 'coke', unitCost: 10, quantity: 1 }],
			[{ productId: 'coke', quantity: 2, unitPrice: 15 }],
		)

		expect(merged?.[0].unitCost).toBe(10)
		expect(merged?.[0].quantity).toBe(2)
	})

	it('does not copy cost onto a replaced product line', () => {
		const merged = mergeInvoiceItemsPreservingUnitCost(
			[{ productId: 'coke', unitCost: 10 }],
			[{ productId: 'fanta', quantity: 1 }],
		)

		expect(merged?.[0].unitCost).toBeUndefined()
	})
})
