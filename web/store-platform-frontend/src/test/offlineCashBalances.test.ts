import { describe, expect, it } from 'vitest'
import {
	applyPendingCash,
	cashPostsFromPendingCreate,
} from '../offline/offlineCashBalances'

const snapshot = {
	accounts: [
		{ type: 'daily_cash', name: 'Daily', balances: { syp: 100 } },
		{ type: 'cash_reserve', name: 'Reserve', balances: { syp: 40 } },
		{ type: 'online', name: 'Online', balances: { syp: 10 } },
	],
	totals: { syp: 150 },
}

const rates = [
	{
		currencyId: 'syp',
		label: 'SYP',
		name: 'Syrian Pound',
		exchangeRate: 1,
	},
	{
		currencyId: 'usd',
		label: 'USD',
		name: 'US Dollar',
		exchangeRate: 2,
	},
]

describe('offline cash balances', () => {
	it('adds a pending cash sale and a card sale onto the last server balances', () => {
		const posts = [
			...cashPostsFromPendingCreate(
				'invoice',
				{
					warehouseId: 'w1',
					status: 'paid',
					paymentType: 'cash',
					currencyAmounts: [
						{ isPrimary: true, amount: 25, paidAmount: 25, currencyId: 'syp' },
					],
				},
				rates,
			),
			...cashPostsFromPendingCreate(
				'invoice',
				{
					warehouseId: 'w1',
					status: 'confirmed',
					paymentType: 'card',
					currencyAmounts: [
						{ isPrimary: true, amount: 8, paidAmount: 8, currencyId: 'syp' },
					],
				},
				rates,
			),
		]

		expect(applyPendingCash(snapshot, posts)).toEqual({
			accounts: [
				{ type: 'daily_cash', name: 'Daily', balances: { syp: 125 } },
				{ type: 'cash_reserve', name: 'Reserve', balances: { syp: 40 } },
				{ type: 'online', name: 'Online', balances: { syp: 18 } },
			],
			totals: { syp: 183 },
		})
	})

	it('skips credit and drafts, and subtracts a cash purchase', () => {
		expect(
			cashPostsFromPendingCreate(
				'invoice',
				{
					warehouseId: 'w1',
					status: 'confirmed',
					paymentType: 'credit',
					currencyAmounts: [
						{ isPrimary: true, amount: 50, paidAmount: 0, currencyId: 'syp' },
					],
				},
				rates,
			),
		).toEqual([])
		expect(
			cashPostsFromPendingCreate(
				'buyingInvoice',
				{
					warehouseId: 'w1',
					status: 'paid',
					paymentType: 'cash',
					currencyAmounts: [
						{ isPrimary: true, amount: 30, paidAmount: 30, currencyId: 'syp' },
					],
				},
				rates,
			),
		).toEqual([{ accountType: 'daily_cash', currencyId: 'syp', amount: -30 }])
	})

	it('moves a pending transfer between accounts in that currency', () => {
		const posts = cashPostsFromPendingCreate(
			'cashTransfer',
			{
				warehouseId: 'w1',
				fromAccountType: 'daily_cash',
				toAccountType: 'cash_reserve',
				amount: 15,
				currencyId: 'syp',
			},
			rates,
		)

		expect(applyPendingCash(snapshot, posts)).toEqual({
			accounts: [
				{ type: 'daily_cash', name: 'Daily', balances: { syp: 85 } },
				{ type: 'cash_reserve', name: 'Reserve', balances: { syp: 55 } },
				{ type: 'online', name: 'Online', balances: { syp: 10 } },
			],
			totals: { syp: 150 },
		})
	})

	it('posts a receipt in a secondary currency onto the chosen account', () => {
		expect(
			cashPostsFromPendingCreate(
				'dailyAction',
				{
					warehouseId: 'w1',
					entryType: 'RECEIPT_ENTRY',
					cashAccountType: 'cash_reserve',
					singleUnitPrice: '10',
					currencyId: 'usd',
				},
				rates,
			),
		).toEqual([{ accountType: 'cash_reserve', currencyId: 'usd', amount: 10 }])
	})
})
