import { formatNumber } from '../../shared/utils'
import type {
	SellingInvoice,
	SellingInvoiceSortKey,
	SortDirection,
} from './types'

export const formatCurrency = (amount: number) =>
	`${formatNumber(amount) ?? '0.00'} ل.س `

export const formatTrend = (value: number, suffix = '%') => {
	const prefix = value >= 0 ? '↑' : '↓'
	const absValue = Math.abs(value)
	return suffix === '%'
		? `${prefix} ${absValue.toFixed(1)}%`
		: `${prefix} ${absValue}`
}

const parseTimeToMinutes = (time: string) => {
	const [timePart, period] = time.split(' ')
	const [hours, minutes] = timePart.split(':').map(Number)
	let hour24 = hours

	if (period === 'PM' && hours !== 12) hour24 += 12
	if (period === 'AM' && hours === 12) hour24 = 0

	return hour24 * 60 + minutes
}

export const sortInvoices = (
	invoices: SellingInvoice[],
	sortKey: SellingInvoiceSortKey,
	direction: SortDirection,
) => {
	const sorted = [...invoices]

	sorted.sort((a, b) => {
		let comparison = 0

		if (sortKey === 'invoiceNumber') {
			comparison = a.invoiceNumber - b.invoiceNumber
		} else {
			comparison = parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
		}

		return direction === 'asc' ? comparison : -comparison
	})

	return sorted
}

export const filterInvoices = (
	invoices: SellingInvoice[],
	searchText: string,
	statusFilter: string,
) => {
	const normalizedSearch = searchText.trim().toLowerCase()

	return invoices.filter(invoice => {
		const matchesStatus =
			statusFilter === 'all' || invoice.status === statusFilter

		if (!matchesStatus) return false

		if (!normalizedSearch) return true

		return (
			String(invoice.invoiceNumber).includes(normalizedSearch) ||
			invoice.customerName.toLowerCase().includes(normalizedSearch)
		)
	})
}
