import { describe, expect, it } from 'vitest'

import { DailyActionType } from '../shared/globalEnums'
import {
	buildPartyActivityRows,
	formatPartyActivityWhen,
	partyCashEntries,
	type PartyEntryActivity,
	type PartyInvoiceActivity,
} from '../components/common/partyActivityRows'
import type { SellingInvoice } from '../components/SellingInvoice/types'

const invoice = (
	id: string,
	status: SellingInvoice['status'],
	sortKey: number,
	kind: 'selling' | 'buying' = 'selling',
): PartyInvoiceActivity => ({
	kind,
	sortKey,
	invoice: {
		id,
		invoiceNumber: 1,
		time: '01:00 AM',
		customerName: 'A',
		status,
		paymentType: 'cash',
		itemCount: 1,
		total: 10,
		paid: 10,
		due: 0,
	},
})

const entry = (id: string, sortKey: number): PartyEntryActivity => ({
	kind: 'entry',
	sortKey,
	row: {
		kind: 'entry',
		entrySubType: 'receipt',
		id,
		sortKey,
		time: '02:00 AM',
		entityName: 'A',
		amount: 5,
		currencyId: 'c',
		currencyName: 'USD',
	},
	source: {
		actionId: id,
		entryType: DailyActionType.RECEIPT_ENTRY,
		currencyId: 'c',
		currencyName: 'USD',
		invoiceDate: '2024-01-01',
	},
})

const action = (
	actionId: string,
	entryType: DailyActionType,
): DailyAction => ({
	actionId,
	entryType,
	currencyId: 'c',
	currencyName: 'USD',
	invoiceDate: '2024-01-01',
	singleUnitPrice: '5',
})

describe('party activity rows', () => {
	it('keeps every party entry, including selling and buying', () => {
		const rows = partyCashEntries([
			action('sell', DailyActionType.SELLING_ENTRY),
			action('buy', DailyActionType.BUYING_ENTRY),
			action('expense', DailyActionType.EXPENSE_ENTRY),
			action('pay', DailyActionType.PAYMENT_ENTRY),
			action('rec', DailyActionType.RECEIPT_ENTRY),
		])

		expect(rows.map(row => row.row.id)).toEqual([
			'sell',
			'buy',
			'expense',
			'pay',
			'rec',
		])
		expect(rows.map(row => row.row.entrySubType)).toEqual([
			'selling',
			'buying',
			'expense',
			'payment',
			'receipt',
		])
	})

	it('mixes invoices and cash entries newest first, and filters the chips', () => {
		const selling = [invoice('s', 'paid', 10)]
		const buying = [invoice('b', 'credit', 30, 'buying')]
		const entries = [entry('e', 20)]

		expect(
			buildPartyActivityRows(selling, buying, entries, 'all').map(row =>
				row.kind === 'entry' ? row.row.id : row.invoice.id,
			),
		).toEqual(['b', 'e', 's'])

		expect(
			buildPartyActivityRows(selling, buying, entries, 'paid').map(row =>
				row.kind === 'entry' ? row.row.id : row.invoice.id,
			),
		).toEqual(['s'])

		expect(
			buildPartyActivityRows(selling, buying, entries, 'entries').map(row =>
				row.kind === 'entry' ? row.row.id : row.invoice.id,
			),
		).toEqual(['e'])
	})

	it('prefixes the clock with the sortKey date', () => {
		const sortKey = new Date(2024, 0, 2, 14, 5).valueOf()
		expect(formatPartyActivityWhen(sortKey, '02:05 PM')).toBe(
			'02.01.2024 02:05 PM',
		)
		expect(formatPartyActivityWhen(0, '02:05 PM')).toBe('02:05 PM')
	})
})
