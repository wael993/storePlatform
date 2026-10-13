import { describe, expect, it } from 'vitest'
import { readInvoiceSummaryKpis } from '../components/dashboard/invoiceSummaryKpis'

const summary = {
	todaySales: 15,
	totalProfit: 5,
	profitReliable: true,
	totalReceivable: 40,
	bestSeller: { productName: 'Cola', quantity: 3 },
	topProfitProduct: { productName: 'Cola', profit: 5 },
}

describe('readInvoiceSummaryKpis', () => {
	it('keeps period sales, profit, and the top products when cost is known', () => {
		expect(readInvoiceSummaryKpis(summary)).toEqual({
			sales: 15,
			profit: 5,
			profitPartial: false,
			receivable: 40,
			bestSeller: summary.bestSeller,
			bestSellers: [summary.bestSeller],
			topProfit: summary.topProfitProduct,
			topProfitProducts: [summary.topProfitProduct],
		})
	})

	it('keeps the returned profit and marks the card when cost is unknown', () => {
		expect(
			readInvoiceSummaryKpis({
				...summary,
				profitReliable: false,
				totalProfit: 12,
				topProfitProduct: { productName: 'Cola', profit: 12 },
				topProfitProducts: [{ productName: 'Cola', profit: 12 }],
			}),
		).toMatchObject({
			sales: 15,
			profit: 12,
			profitPartial: true,
			receivable: 40,
			topProfit: { productName: 'Cola', profit: 12 },
			topProfitProducts: [{ productName: 'Cola', profit: 12 }],
		})
	})

	it('withholds sales when the period has no posted sales', () => {
		expect(
			readInvoiceSummaryKpis({
				...summary,
				todaySales: 0,
				totalProfit: 0,
				bestSeller: null,
				topProfitProduct: null,
			}),
		).toMatchObject({
			sales: null,
			profit: 0,
			profitPartial: false,
			receivable: 40,
			bestSellers: [],
			topProfitProducts: [],
		})
	})
})
