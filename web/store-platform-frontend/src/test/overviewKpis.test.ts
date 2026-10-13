import { describe, expect, it } from 'vitest'
import {
	combineSideStatus,
	countCreatedInRange,
	countPostedInvoices,
	splitPartyBalances,
	sumInventoryCost,
} from '../components/dashboard/overviewKpis'

describe('splitPartyBalances', () => {
	it('puts supplier credit with money owed to us and customer credit with what we owe', () => {
		expect(
			splitPartyBalances(
				[
					{ totalReceivable: 10 },
					{ totalReceivable: -4 },
					{ totalReceivable: 0 },
				],
				[{ totalPayable: 7 }, { totalPayable: -3 }],
			),
		).toEqual({ owedToUs: 13, weOwe: 11 })
	})
})

describe('combineSideStatus', () => {
	it('uses only the sides that were passed', () => {
		expect(combineSideStatus([null, null])).toBe('unavailable')
		expect(combineSideStatus(['ready', null])).toBe('ready')
		expect(combineSideStatus(['ready', 'loading'])).toBe('loading')
		expect(combineSideStatus([null, 'error'])).toBe('error')
	})
})

describe('countCreatedInRange', () => {
	it('counts customers created inside the dashboard range', () => {
		expect(
			countCreatedInRange(
				['2026-10-02T10:00:00.000Z', '2026-09-01T10:00:00.000Z', undefined],
				new Date(2026, 9, 1),
				new Date(2026, 9, 13),
			),
		).toBe(1)
	})
})

describe('countPostedInvoices', () => {
	it('skips draft, cancelled, void, and pending invoices', () => {
		expect(
			countPostedInvoices([
				'paid',
				'draft',
				'cancelled',
				'void',
				'pending',
				'confirmed',
			]),
		).toBe(2)
	})
})

describe('sumInventoryCost', () => {
	it('sums quantity times cost and marks missing cost as partial', () => {
		expect(
			sumInventoryCost([
				{ quantity: 2, averageCost: 10 },
				{ quantity: 4 },
				{ quantity: 0 },
			]),
		).toEqual({ total: 20, partial: true })
	})

	it('stays complete when every stocked row has a cost', () => {
		expect(
			sumInventoryCost([{ quantity: 0 }, { quantity: 3, averageCost: 5 }]),
		).toEqual({
			total: 15,
			partial: false,
		})
	})
})
