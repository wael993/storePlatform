import dayjs from 'dayjs'

import { formatDate } from '../../shared/dateUtils'
import { DailyActionType } from '../../shared/globalEnums'
import {
	getDailyActionEntryTypeValue,
	mapDailyActionToEntryTableRow,
	type EntryTableRow,
} from '../SellingInvoice/entryTableMappers'
import type { SellingInvoice } from '../SellingInvoice/types'

export type PartyActivityFilter =
	'all' | 'paid' | 'credit' | 'partial' | 'entries'

export type PartyInvoiceActivity = {
	kind: 'selling' | 'buying'
	sortKey: number
	invoice: SellingInvoice
}

export type PartyEntryActivity = {
	kind: 'entry'
	sortKey: number
	row: EntryTableRow
	source: DailyAction
}

export type PartyActivity = PartyInvoiceActivity | PartyEntryActivity

const TRADE_ENTRY_SUBTYPE = {
	[DailyActionType.SELLING_ENTRY]: 'selling',
	[DailyActionType.BUYING_ENTRY]: 'buying',
} as const

const tradeEntryAmount = (action: DailyAction) => {
	const total = Number(String(action.totalPrice ?? '').replace(/,/g, ''))
	if (
		action.totalPrice != null &&
		action.totalPrice !== '' &&
		Number.isFinite(total)
	) {
		return total
	}

	const unit = Number(String(action.singleUnitPrice ?? '').replace(/,/g, ''))
	return Number.isFinite(unit) ? unit : 0
}

const tradeEntryRow = (action: DailyAction): EntryTableRow | null => {
	const entryType = getDailyActionEntryTypeValue(action.entryType)
	const entrySubType =
		entryType && entryType in TRADE_ENTRY_SUBTYPE
			? TRADE_ENTRY_SUBTYPE[entryType as keyof typeof TRADE_ENTRY_SUBTYPE]
			: undefined
	if (!entrySubType) return null

	const id = action.actionId ?? action._id
	if (!id) return null

	const sortSource = action.invoiceDate ?? action.createdAt
	return {
		kind: 'entry',
		entrySubType,
		id,
		sortKey: sortSource ? dayjs(sortSource).valueOf() || 0 : 0,
		time: sortSource ? dayjs(sortSource).format('hh:mm A') : '--:--',
		entityName:
			action.customerName ?? action.supplierName ?? action.productName ?? '-',
		amount: tradeEntryAmount(action),
		currencyId: action.currencyId ?? '',
		currencyName: action.currencyName ?? '',
		note: action.note,
	}
}

export const isQuickEntryActivity = (row: EntryTableRow) =>
	row.entrySubType === 'receipt' ||
	row.entrySubType === 'payment' ||
	row.entrySubType === 'expense'

export const partyCashEntries = (
	actions: DailyAction[],
): PartyEntryActivity[] =>
	actions.flatMap(action => {
		const row = mapDailyActionToEntryTableRow(action) ?? tradeEntryRow(action)
		if (!row) return []

		return [
			{
				kind: 'entry' as const,
				sortKey: row.sortKey,
				row,
				source: action,
			},
		]
	})

export const partyInvoiceActivity = (
	kind: 'selling' | 'buying',
	invoice: SellingInvoice,
	issuedAt?: string,
): PartyInvoiceActivity => ({
	kind,
	sortKey: issuedAt ? dayjs(issuedAt).valueOf() || 0 : 0,
	invoice,
})

export const buildPartyActivityRows = (
	selling: PartyInvoiceActivity[],
	buying: PartyInvoiceActivity[],
	entries: PartyEntryActivity[],
	filter: PartyActivityFilter,
): PartyActivity[] => {
	const invoices =
		filter === 'entries'
			? []
			: [...selling, ...buying].filter(row =>
					filter === 'all' ? true : row.invoice.status === filter,
				)
	const cashEntries = filter === 'all' || filter === 'entries' ? entries : []

	return [...invoices, ...cashEntries].sort((a, b) => b.sortKey - a.sortKey)
}

export const formatPartyActivityWhen = (sortKey: number, time: string) => {
	if (!sortKey) return time
	const date = formatDate(new Date(sortKey))
	return date ? `${date} ${time}` : time
}

const invoiceCountsTowardBalance = (status: string) =>
	status !== 'draft' && status !== 'cancelled' && status !== 'void'

/** Open remainder. A fully paid invoice has no balance. */
const balanceMagnitude = (total: number, paid: number) =>
	Math.max(0, total - paid)

/**
 * This row's own balance, not a running sum.
 * Customer and partner: selling and payment are +, buying and receipt are -.
 * Supplier: buying and receipt are +, selling and payment are -.
 */
export const partyActivityBalanceAmount = (
	party: 'customer' | 'supplier' | 'partner',
	row: PartyActivity,
	entryAmount: number,
): number => {
	if (row.kind === 'entry') {
		const subType = row.row.entrySubType
		const adds =
			party === 'supplier'
				? subType === 'buying' || subType === 'receipt'
				: subType === 'selling' || subType === 'payment'
		const subtracts =
			party === 'supplier'
				? subType === 'selling' || subType === 'payment'
				: subType === 'buying' || subType === 'receipt'
		if (adds) return entryAmount
		if (subtracts) return -entryAmount
		return 0
	}

	if (
		!invoiceCountsTowardBalance(row.invoice.status) ||
		row.invoice.status === 'paid'
	) {
		return 0
	}

	const amount = balanceMagnitude(row.invoice.total, row.invoice.paid)
	const adds =
		party === 'supplier' ? row.kind === 'buying' : row.kind === 'selling'
	return adds ? amount : -amount
}

export const partyActivityBalanceTone = (
	balance: number,
): { sign: '+' | '-' | ''; color: string } => {
	if (balance > 0) return { sign: '+', color: '#15803D' }
	if (balance < 0) return { sign: '-', color: '#C2410C' }
	return { sign: '', color: 'gray.900' }
}
