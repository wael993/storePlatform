import type { InvoiceTableRow } from './entryTableMappers'
import type {
	SellingInvoice,
	SellingInvoiceSortKey,
	SortDirection,
} from './types'

type PartyRow = { id: string; name: string }

/** Partners, then the entry's own party type, then the other. Same order as quick entries. */
export const buildEntryPartyOptions = (
	partners: Array<{ partnerId?: string; internalCode?: string; name?: string }>,
	first: PartyRow[],
	second: PartyRow[],
): DropdownOption[] => {
	const partnerOptions = partners
		.map(partner => ({
			value: partner.partnerId ?? partner.internalCode ?? '',
			label: partner.name ?? partner.internalCode ?? 'TBD',
		}))
		.filter(option => option.value)

	return [
		...partnerOptions,
		...first.map(party => ({ value: party.id, label: party.name })),
		...second.map(party => ({ value: party.id, label: party.name })),
	]
}

const parseTimeToMinutes = (time: string) => {
	const [timePart, period] = time.split(' ')
	const [hours, minutes] = timePart.split(':').map(Number)
	let hour24 = hours

	if (period === 'PM' && hours !== 12) hour24 += 12
	if (period === 'AM' && hours === 12) hour24 = 0

	return hour24 * 60 + minutes
}

const getRowSortNumber = (row: InvoiceTableRow) =>
	row.kind === 'entry' || row.kind === 'transfer'
		? row.sortKey
		: row.invoiceNumber

export const sortTableRows = (
	rows: InvoiceTableRow[],
	sortKey: SellingInvoiceSortKey,
	direction: SortDirection,
) => {
	const sorted = [...rows]

	sorted.sort((a, b) => {
		let comparison = 0

		if (sortKey === 'invoiceNumber') {
			comparison = getRowSortNumber(a) - getRowSortNumber(b)
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
