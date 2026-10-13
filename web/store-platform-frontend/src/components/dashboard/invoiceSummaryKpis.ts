/** Period figures from the selling-invoice summary. Sales is null when the period has no posted sales. Profit is the returned total; profitPartial means some cost is missing. */
export interface InvoiceSummaryKpiInput {
	todaySales: number
	totalProfit: number
	profitReliable?: boolean
	totalReceivable: number
	bestSeller: { productName: string; quantity: number } | null
	bestSellers?: Array<{ productName: string; quantity: number }>
	topProfitProduct: { productName: string; profit: number } | null
	topProfitProducts?: Array<{ productName: string; profit: number }>
}

export interface InvoiceSummaryKpis {
	sales: number | null
	profit: number
	/** Some sold quantity has no cost, so the profit figure is not complete. */
	profitPartial: boolean
	receivable: number
	bestSeller: InvoiceSummaryKpiInput['bestSeller']
	bestSellers: Array<{ productName: string; quantity: number }>
	topProfit: InvoiceSummaryKpiInput['topProfitProduct']
	topProfitProducts: Array<{ productName: string; profit: number }>
}

export const readInvoiceSummaryKpis = (
	summary: InvoiceSummaryKpiInput,
): InvoiceSummaryKpis => {
	const hasPeriodData =
		summary.bestSeller !== null ||
		summary.topProfitProduct !== null ||
		summary.todaySales > 0

	return {
		sales: hasPeriodData ? summary.todaySales : null,
		profit: summary.totalProfit,
		profitPartial: summary.profitReliable !== true,
		receivable: summary.totalReceivable,
		bestSeller: summary.bestSeller,
		bestSellers:
			summary.bestSellers ?? (summary.bestSeller ? [summary.bestSeller] : []),
		topProfit: summary.topProfitProduct,
		topProfitProducts:
			summary.topProfitProducts ??
			(summary.topProfitProduct ? [summary.topProfitProduct] : []),
	}
}
