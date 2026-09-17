import { finiteCost } from './inventoryCost'

export type ProfitInvoiceLine = {
	productId?: string
	name?: string
	quantity?: number
	unitPrice?: number
	lineTotal?: number
	unitCost?: number
}

export type ProfitStockMoving = {
	type?: unknown
	productId?: unknown
	quantity?: unknown
	unitCost?: unknown
	referenceId?: unknown
	createdAt?: unknown
	createdBy?: { createdAt?: unknown }
}

export type ProductProfitAggregate = {
	productId: string
	productName: string
	quantitySold: number
	revenue: number
	cogs: number
	profit: number
}

export const invoiceLineRevenue = (item: ProfitInvoiceLine): number => {
	if (item.lineTotal != null) return Number(item.lineTotal)

	return Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0)
}

/** Spread invoice-level discount (grandTotal vs line sum) across lines. */
export const allocateNetLineRevenues = (
	items: ProfitInvoiceLine[],
	grandTotal: number,
): Array<{
	productId: string
	productName: string
	quantity: number
	netRevenue: number
	unitCost?: number
}> => {
	const lines = items.filter(
		(item): item is ProfitInvoiceLine & { productId: string } =>
			Boolean(item.productId),
	)
	const lineRevenues = lines.map(invoiceLineRevenue)
	const linesSum = lineRevenues.reduce((total, value) => total + value, 0)
	const delta = linesSum > 0 ? linesSum - grandTotal : 0

	return lines.map((item, index) => {
		const lineRevenue = lineRevenues[index]
		const share =
			delta !== 0 && linesSum > 0 ? (lineRevenue / linesSum) * delta : 0

		return {
			productId: item.productId,
			productName: item.name ?? '',
			quantity: Number(item.quantity ?? 0),
			netRevenue: lineRevenue - share,
			unitCost: finiteCost(item.unitCost),
		}
	})
}

const movingTime = (moving: ProfitStockMoving): number => {
	const raw = moving.createdAt ?? moving.createdBy?.createdAt
	const time = raw ? new Date(String(raw)).getTime() : 0

	return Number.isFinite(time) ? time : 0
}

export const originalSaleUnitCostByProduct = (
	movings: ProfitStockMoving[],
): Map<string, number> => {
	const costs = new Map<string, number>()
	const sales = movings
		.filter(moving => moving.type === 'sale')
		.sort((left, right) => movingTime(left) - movingTime(right))

	for (const moving of sales) {
		const productId = String(moving.productId ?? '')

		if (!productId || costs.has(productId)) continue

		const unitCost = finiteCost(moving.unitCost)

		if (unitCost != null) costs.set(productId, unitCost)
	}

	return costs
}

/** Keep newest sale qty that covers current invoice lines; drop leftover stacked sales. */
export const selectCurrentSaleMovings = (
	invoices: Array<{ invoiceId?: unknown; items?: ProfitInvoiceLine[] }>,
	stockMovings: ProfitStockMoving[],
): ProfitStockMoving[] => {
	const neededQty = new Map<string, number>()

	for (const invoice of invoices) {
		const invoiceId = String(invoice.invoiceId ?? '')

		if (!invoiceId) continue

		for (const item of invoice.items ?? []) {
			if (!item.productId) continue

			const key = `${invoiceId}|${item.productId}`

			neededQty.set(key, (neededQty.get(key) ?? 0) + Number(item.quantity ?? 0))
		}
	}

	const salesByKey = new Map<string, ProfitStockMoving[]>()

	for (const moving of stockMovings) {
		if (moving.type !== 'sale') continue

		const key = `${String(moving.referenceId ?? '')}|${String(moving.productId ?? '')}`
		const list = salesByKey.get(key) ?? []

		list.push(moving)
		salesByKey.set(key, list)
	}

	const selected: ProfitStockMoving[] = []

	for (const [key, needed] of neededQty) {
		const sales = (salesByKey.get(key) ?? []).sort(
			(left, right) => movingTime(right) - movingTime(left),
		)
		let remaining = needed

		for (const sale of sales) {
			if (remaining <= 0) break

			const quantity = Number(sale.quantity ?? 0)
			const take = Math.min(quantity, remaining)

			if (take <= 0) continue

			selected.push(take === quantity ? sale : { ...sale, quantity: take })
			remaining -= take
		}
	}

	return selected
}

export const getProductProfitAggregate = (
	aggregates: Map<string, ProductProfitAggregate>,
	productId: string,
	productName = '',
) => {
	const existing = aggregates.get(productId)

	if (existing) {
		if (!existing.productName && productName) {
			existing.productName = productName
		}

		return existing
	}

	const created: ProductProfitAggregate = {
		productId,
		productName,
		quantitySold: 0,
		revenue: 0,
		cogs: 0,
		profit: 0,
	}

	aggregates.set(productId, created)

	return created
}

export const buildPeriodProductAggregates = (
	periodInvoices: Array<{
		items?: ProfitInvoiceLine[]
		grandTotal: number
	}>,
	stockMovings: ProfitStockMoving[],
): {
	aggregates: Map<string, ProductProfitAggregate>
	profitReliable: boolean
} => {
	const aggregates = new Map<string, ProductProfitAggregate>()
	const soldQty = new Map<string, number>()
	const movingQty = new Map<string, number>()
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

			aggregate.revenue += line.netRevenue
			aggregate.quantitySold += line.quantity
			soldQty.set(
				line.productId,
				(soldQty.get(line.productId) ?? 0) + line.quantity,
			)
		}
	}

	for (const moving of stockMovings) {
		if (moving.type !== 'sale') continue

		const productId = String(moving.productId ?? '')

		if (!productId) continue

		const aggregate = getProductProfitAggregate(aggregates, productId)
		const quantity = Number(moving.quantity ?? 0)
		const unitCost = finiteCost(moving.unitCost)

		movingQty.set(productId, (movingQty.get(productId) ?? 0) + quantity)

		if (unitCost == null) {
			profitReliable = false
		} else {
			aggregate.cogs += quantity * unitCost
		}
	}

	for (const [productId, quantity] of soldQty) {
		if (quantity > 0 && (movingQty.get(productId) ?? 0) < quantity) {
			profitReliable = false
		}
	}

	for (const aggregate of aggregates.values()) {
		aggregate.profit = aggregate.revenue - aggregate.cogs
	}

	return { aggregates, profitReliable }
}

export const pickBestSellerSummaryProduct = (
	aggregates: Map<string, ProductProfitAggregate>,
): {
	productId: string
	productName: string
	quantity: number
} | null => {
	const candidates = [...aggregates.values()].filter(
		aggregate => aggregate.quantitySold > 0,
	)

	if (!candidates.length) return null

	candidates.sort((left, right) => {
		if (right.quantitySold !== left.quantitySold) {
			return right.quantitySold - left.quantitySold
		}

		if (right.profit !== left.profit) {
			return right.profit - left.profit
		}

		return left.productName.localeCompare(right.productName)
	})

	const winner = candidates[0]

	return {
		productId: winner.productId,
		productName: winner.productName || winner.productId,
		quantity: winner.quantitySold,
	}
}

export const pickTopProfitSummaryProduct = (
	aggregates: Map<string, ProductProfitAggregate>,
): {
	productId: string
	productName: string
	profit: number
} | null => {
	const candidates = [...aggregates.values()].filter(
		aggregate => aggregate.quantitySold > 0,
	)

	if (!candidates.length) return null

	candidates.sort((left, right) => {
		if (right.profit !== left.profit) {
			return right.profit - left.profit
		}

		if (right.quantitySold !== left.quantitySold) {
			return right.quantitySold - left.quantitySold
		}

		return left.productName.localeCompare(right.productName)
	})

	const winner = candidates[0]

	return {
		productId: winner.productId,
		productName: winner.productName || winner.productId,
		profit: winner.profit,
	}
}

export const totalProfitFromAggregates = (
	aggregates: Map<string, ProductProfitAggregate>,
): number =>
	[...aggregates.values()].reduce(
		(total, aggregate) => total + aggregate.profit,
		0,
	)

/** Keep stamped unitCost on existing product lines when an invoice PATCH replaces items. */
export const mergeInvoiceItemsPreservingUnitCost = <
	T extends { productId?: string; unitCost?: number },
>(
	existingItems: T[] | undefined,
	nextItems: T[] | undefined,
): T[] | undefined => {
	if (!nextItems) return nextItems

	const unused = [...(existingItems ?? [])]

	return nextItems.map(item => {
		const index = unused.findIndex(
			row => row.productId && row.productId === item.productId,
		)

		if (index < 0) return item

		const previous = unused.splice(index, 1)[0]
		const unitCost = finiteCost(previous.unitCost)

		if (unitCost == null) return item

		return { ...item, unitCost }
	})
}
