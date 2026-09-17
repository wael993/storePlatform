import {
	allocateNetLineRevenues,
	finiteCost,
	getProductProfitAggregate,
	mergeQtyWeightedAverageCost,
	type ProductProfitAggregate,
	type ProfitInvoiceLine,
} from 'store-domain'

export {
	allocateNetLineRevenues,
	invoiceLineRevenue,
	pickBestSellerSummaryProduct,
	pickTopProfitSummaryProduct,
	totalProfitFromAggregates,
	type ProductProfitAggregate,
	type ProfitInvoiceLine,
} from 'store-domain'

export { mergeQtyWeightedAverageCost }

export const resolveLocalSaleUnitCost = (
	averageCost: number | undefined,
	purchasePrice: number | undefined,
): number | undefined => finiteCost(averageCost) ?? finiteCost(purchasePrice)

export const buildLocalPeriodProductAggregates = (
	periodInvoices: Array<{
		items?: ProfitInvoiceLine[]
		grandTotal: number
	}>,
): {
	aggregates: Map<string, ProductProfitAggregate>
	profitReliable: boolean
} => {
	const aggregates = new Map<string, ProductProfitAggregate>()
	let profitReliable = true

	for (const invoice of periodInvoices) {
		for (const line of allocateNetLineRevenues(
			invoice.items ?? [],
			invoice.grandTotal,
		)) {
			const aggregate = getProductProfitAggregate(
				aggregates,
				line.productId,
				line.productName,
			)
			const unitCost = finiteCost(line.unitCost)

			if (unitCost == null) {
				profitReliable = false
			} else {
				aggregate.cogs += line.quantity * unitCost
			}

			aggregate.revenue += line.netRevenue
			aggregate.quantitySold += line.quantity
		}
	}

	for (const aggregate of aggregates.values()) {
		aggregate.profit = aggregate.revenue - aggregate.cogs
	}

	return { aggregates, profitReliable }
}
