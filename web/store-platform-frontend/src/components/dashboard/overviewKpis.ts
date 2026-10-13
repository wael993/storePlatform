import { endOfDay, startOfDay } from 'date-fns'

const EXCLUDED_INVOICE_STATUSES = new Set([
	'draft',
	'cancelled',
	'void',
	'pending',
])

/** Positive customer receivable and negative supplier payable are owed to us. */
export const splitPartyBalances = (
	customers: Array<{ totalReceivable?: number }>,
	suppliers: Array<{ totalPayable?: number }>,
) => {
	let owedToUs = 0
	let weOwe = 0

	for (const customer of customers) {
		const balance = customer.totalReceivable ?? 0
		if (balance > 0) owedToUs += balance
		else if (balance < 0) weOwe += -balance
	}

	for (const supplier of suppliers) {
		const balance = supplier.totalPayable ?? 0
		if (balance > 0) weOwe += balance
		else if (balance < 0) owedToUs += -balance
	}

	return { owedToUs, weOwe }
}

export type KpiReadStatus =
	'loading' | 'offline' | 'unavailable' | 'error' | 'ready'

/** First blocking status across the sides this user can see. No sides means unavailable. */
export const combineSideStatus = (
	sides: Array<KpiReadStatus | null>,
): KpiReadStatus => {
	const present = sides.filter(
		(status): status is KpiReadStatus => status != null,
	)
	if (!present.length) return 'unavailable'
	if (present.includes('loading')) return 'loading'
	if (present.includes('error')) return 'error'
	if (present.includes('offline')) return 'offline'
	if (present.includes('unavailable')) return 'unavailable'
	return 'ready'
}

export const countCreatedInRange = (
	createdAt: Array<string | undefined>,
	dateFrom: Date,
	dateTo: Date,
) => {
	const start = startOfDay(dateFrom).getTime()
	const end = endOfDay(dateTo).getTime()

	return createdAt.reduce((count, value) => {
		if (!value) return count
		const time = new Date(value).getTime()
		return time >= start && time <= end ? count + 1 : count
	}, 0)
}

export const countPostedInvoices = (statuses: Array<string | undefined>) =>
	statuses.filter(status => !EXCLUDED_INVOICE_STATUSES.has(status ?? '')).length

/** Missing cost is excluded, never treated as 0. `partial` means some qty had no cost. */
export const sumInventoryCost = (
	rows: Array<{ quantity?: number; averageCost?: number }>,
) => {
	let total = 0
	let partial = false

	for (const row of rows) {
		const quantity = Number(row.quantity ?? 0)
		if (!Number.isFinite(quantity) || quantity <= 0) continue
		if (row.averageCost == null || !Number.isFinite(row.averageCost)) {
			partial = true
			continue
		}
		total += quantity * row.averageCost
	}

	return { total, partial }
}
