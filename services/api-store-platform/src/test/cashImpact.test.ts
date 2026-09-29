import { describe, expect, it } from 'vitest'

import {
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
	DailyActionType,
} from '../shared/globalEnums'
import {
	desiredPostsForBuyingInvoice,
	desiredPostsForDailyAction,
	desiredPostsForSellingInvoice,
	sumDesiredPosts,
} from '../shared/cashAccounts/cashImpact'
import { toPrimaryCashAmount } from '../shared/cashAccounts/posting'
import { ratesFromCurrencySettings } from '../shared/inventoryCost'
import {
	CASH_ACCOUNT_TYPES,
	CASH_MOVEMENT_TYPES,
	validateCashTransferInput,
} from '../shared/cashAccounts/types'

describe('cashImpact', () => {
	it('maps cash sales to daily_cash and card sales to online', () => {
		expect(
			desiredPostsForSellingInvoice({
				status: InvoiceStatus.PAID,
				paymentType: InvoicePaymentType.CASH,
				grandTotal: 100,
				paidAmount: 100,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				amount: 100,
				movementType: CASH_MOVEMENT_TYPES.SALE,
			},
		])

		expect(
			desiredPostsForSellingInvoice({
				status: InvoiceStatus.PAID,
				paymentType: InvoicePaymentType.CARD,
				grandTotal: 40,
				paidAmount: 40,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.ONLINE,
				amount: 40,
				movementType: CASH_MOVEMENT_TYPES.SALE,
			},
		])
	})

	it('ignores credit sales and uses paidAmount for partials', () => {
		expect(
			desiredPostsForSellingInvoice({
				status: InvoiceStatus.PAID,
				paymentType: InvoicePaymentType.CREDIT,
				grandTotal: 50,
				paidAmount: 50,
			}),
		).toEqual([])

		expect(
			desiredPostsForSellingInvoice({
				status: InvoiceStatus.PARTIAL,
				paymentType: InvoicePaymentType.CASH,
				grandTotal: 50,
				paidAmount: 10,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				amount: 10,
				movementType: CASH_MOVEMENT_TYPES.SALE,
			},
		])
	})

	it('subtracts cash and card purchases from paymentType accounts', () => {
		expect(
			desiredPostsForBuyingInvoice({
				status: InvoiceStatus.PAID,
				paymentType: InvoicePaymentType.CASH,
				grandTotal: 20,
				paidAmount: 20,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				amount: -20,
				movementType: CASH_MOVEMENT_TYPES.PURCHASE,
			},
		])

		expect(
			desiredPostsForBuyingInvoice({
				status: InvoiceStatus.PAID,
				paymentType: InvoicePaymentType.CARD,
				grandTotal: 20,
				paidAmount: 20,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.ONLINE,
				amount: -20,
				movementType: CASH_MOVEMENT_TYPES.PURCHASE,
			},
		])
	})

	it('maps receipt/payment/expense to daily_cash', () => {
		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.RECEIPT_ENTRY,
				amount: 15,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				amount: 15,
				movementType: CASH_MOVEMENT_TYPES.RECEIPT,
			},
		])

		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.PAYMENT_ENTRY,
				amount: 5,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				amount: -5,
				movementType: CASH_MOVEMENT_TYPES.PAYMENT,
			},
		])

		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.EXPENSE_ENTRY,
				amount: 3,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				amount: -3,
				movementType: CASH_MOVEMENT_TYPES.EXPENSE,
			},
		])
	})

	it('posts receipt/payment/expense to the selected cash account', () => {
		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.RECEIPT_ENTRY,
				amount: 20,
				accountType: CASH_ACCOUNT_TYPES.ONLINE,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.ONLINE,
				amount: 20,
				movementType: CASH_MOVEMENT_TYPES.RECEIPT,
			},
		])

		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.PAYMENT_ENTRY,
				amount: 8,
				accountType: CASH_ACCOUNT_TYPES.CASH_RESERVE,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.CASH_RESERVE,
				amount: -8,
				movementType: CASH_MOVEMENT_TYPES.PAYMENT,
			},
		])

		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.EXPENSE_ENTRY,
				amount: 4,
				accountType: 'not_a_real_account',
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				amount: -4,
				movementType: CASH_MOVEMENT_TYPES.EXPENSE,
			},
		])
	})

	it('keeps transfer legs total-neutral', () => {
		expect(
			sumDesiredPosts([
				{
					accountType: CASH_ACCOUNT_TYPES.CASH_RESERVE,
					amount: -500,
					movementType: CASH_MOVEMENT_TYPES.TRANSFER,
				},
				{
					accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
					amount: 500,
					movementType: CASH_MOVEMENT_TYPES.TRANSFER,
				},
			]),
		).toBe(0)
	})

	it('validates transfer input and rejects bad cases', () => {
		expect(
			validateCashTransferInput({
				fromAccountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				toAccountType: CASH_ACCOUNT_TYPES.CASH_RESERVE,
				amount: 12.5,
			}),
		).toEqual({
			fromAccountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
			toAccountType: CASH_ACCOUNT_TYPES.CASH_RESERVE,
			amount: 12.5,
		})

		expect(() =>
			validateCashTransferInput({
				fromAccountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				toAccountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				amount: 10,
			}),
		).toThrow('From and To accounts must be different.')

		expect(() =>
			validateCashTransferInput({
				fromAccountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				toAccountType: CASH_ACCOUNT_TYPES.ONLINE,
				amount: 0,
			}),
		).toThrow('Transfer amount must be greater than zero.')

		expect(() =>
			validateCashTransferInput({
				fromAccountType: 'not_an_account',
				toAccountType: CASH_ACCOUNT_TYPES.ONLINE,
				amount: 5,
			}),
		).toThrow('From account type is invalid.')
	})

	it('converts secondary-currency cash amounts to primary before posting', () => {
		// Primary USD; 1 USD = 10000 SYP → SYP.exchangeRate = 10000 (primary→display).
		const rates = ratesFromCurrencySettings({
			primaryCurrency: {
				currencyId: 'usd',
				name: 'US Dollar',
				internalCode: 'USD',
			},
			secondaryCurrencies: [
				{
					currencyId: 'syp',
					name: 'Syrian Pound',
					internalCode: 'SYP',
					exchangeRate: 10000,
				},
			],
		})

		expect(toPrimaryCashAmount(500, 'syp', rates)).toBe(0.05)
		expect(toPrimaryCashAmount(500, 'usd', rates)).toBe(500)

		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.PAYMENT_ENTRY,
				amount: toPrimaryCashAmount(500, 'syp', rates),
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				amount: -0.05,
				movementType: CASH_MOVEMENT_TYPES.PAYMENT,
			},
		])
	})

	it('ignores drafts', () => {
		expect(
			desiredPostsForSellingInvoice({
				status: InvoiceStatus.DRAFT,
				paymentStatus: InvoicePaymentStatus.PAID,
				paymentType: InvoicePaymentType.CASH,
				grandTotal: 99,
				paidAmount: 99,
			}),
		).toEqual([])
	})
})
