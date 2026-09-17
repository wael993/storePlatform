import { describe, expect, it } from 'vitest'

import {
	allocateNetLineRevenues,
	buildLocalPeriodProductAggregates,
	mergeQtyWeightedAverageCost,
	resolveLocalSaleUnitCost,
	totalProfitFromAggregates,
} from '../components/SellingInvoice/invoiceProfitSummary'
import { mapApiSummaryToUi } from '../components/SellingInvoice/invoiceApiMappers'
import { mergeInvoiceItemsPreservingUnitCost } from 'store-domain'

describe('resolveLocalSaleUnitCost', () => {
	it('prefers inventory averageCost over catalog purchasePrice', () => {
		expect(resolveLocalSaleUnitCost(10, 12)).toBe(10)
	})

	it('falls back to catalog purchasePrice for opening stock', () => {
		expect(resolveLocalSaleUnitCost(undefined, 10)).toBe(10)
	})

	it('does not treat missing cost as zero', () => {
		expect(resolveLocalSaleUnitCost(undefined, undefined)).toBeUndefined()
	})

	it('does not coerce missing warehouse costs to zero when merging', () => {
		expect(
			mergeQtyWeightedAverageCost(undefined, 5, undefined, 5),
		).toBeUndefined()
		expect(mergeQtyWeightedAverageCost(10, 5, undefined, 5)).toBe(10)
		expect(mergeQtyWeightedAverageCost(undefined, 5, 8, 5)).toBe(8)
		expect(mergeQtyWeightedAverageCost('10', 5, Number.NaN, 5)).toBe(10)
		expect(mergeQtyWeightedAverageCost(null, 5, undefined, 5)).toBeUndefined()
		expect(
			mergeQtyWeightedAverageCost(
				mergeQtyWeightedAverageCost(10, 5, undefined, 5),
				5,
				8,
				5,
			),
		).toBe(9)
	})
})

describe('offline profit summary', () => {
	it('uses local opening cost after extra-zero correction', () => {
		const { aggregates, profitReliable } = buildLocalPeriodProductAggregates([
			{
				grandTotal: 15,
				items: [
					{
						productId: 'coke',
						name: 'Coca Cola',
						quantity: 1,
						unitPrice: 15,
						lineTotal: 15,
						unitCost: 10,
					},
				],
			},
		])

		expect(profitReliable).toBe(true)
		expect(totalProfitFromAggregates(aggregates)).toBe(5)
	})

	it('allocates invoice discount into net revenue', () => {
		const [line] = allocateNetLineRevenues(
			[{ productId: 'coke', quantity: 1, lineTotal: 100 }],
			90,
		)

		expect(line.netRevenue).toBe(90)

		const { aggregates, profitReliable } = buildLocalPeriodProductAggregates([
			{
				grandTotal: 90,
				items: [
					{
						productId: 'coke',
						quantity: 1,
						lineTotal: 100,
						unitCost: 60,
					},
				],
			},
		])

		expect(profitReliable).toBe(true)
		expect(totalProfitFromAggregates(aggregates)).toBe(30)
	})

	it('keeps a posted local sale snapshot when live cost later changes', () => {
		const { aggregates, profitReliable } = buildLocalPeriodProductAggregates([
			{
				grandTotal: 15,
				items: [
					{
						productId: 'coke',
						quantity: 1,
						lineTotal: 15,
						unitCost: 10,
					},
				],
			},
		])

		expect(profitReliable).toBe(true)
		expect(totalProfitFromAggregates(aggregates)).toBe(5)
	})

	it('marks profit unreliable when local cost is missing', () => {
		const { profitReliable, aggregates } = buildLocalPeriodProductAggregates([
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
		])

		expect(profitReliable).toBe(false)
		expect(totalProfitFromAggregates(aggregates)).toBe(15)
	})
})

describe('mapApiSummaryToUi profitReliable', () => {
	const base = {
		todaySales: 15,
		paidInvoices: 0,
		creditInvoices: 0,
		totalReceivable: 0,
		averageOrder: 15,
		totalProfit: 15,
		bestSeller: null,
		topProfitProduct: null,
	}

	it('treats omitted profitReliable as false and keeps explicit true', () => {
		expect(mapApiSummaryToUi(base).profitReliable).toBe(false)
		expect(
			mapApiSummaryToUi({ ...base, profitReliable: true }).profitReliable,
		).toBe(true)
		expect(
			mapApiSummaryToUi({ ...base, profitReliable: false }).profitReliable,
		).toBe(false)
	})
})

describe('mergeInvoiceItemsPreservingUnitCost', () => {
	it('keeps the stamped cost on an existing line after qty/price edit', () => {
		const merged = mergeInvoiceItemsPreservingUnitCost(
			[{ productId: 'coke', unitCost: 10, quantity: 1 }],
			[{ productId: 'coke', quantity: 2, unitPrice: 25 }],
		)

		expect(merged?.[0]).toMatchObject({ quantity: 2, unitCost: 10 })
	})

	it('leaves a new line without a copied cost', () => {
		const merged = mergeInvoiceItemsPreservingUnitCost(
			[{ productId: 'coke', unitCost: 10 }],
			[
				{ productId: 'coke', quantity: 1 },
				{ productId: 'fanta', quantity: 1 },
			],
		)

		expect(merged?.[0].unitCost).toBe(10)
		expect(merged?.[1].unitCost).toBeUndefined()
	})
})
