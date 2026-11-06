import { describe, expect, it } from 'vitest'

import {
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
	DailyActionType,
} from '../shared/globalEnums'
import {
	allocateCashTenders,
	currencyBalanceOf,
	debitFitsCurrencyBalance,
} from '../shared/store-domain/cashTender'
import {
	desiredPostsForBuyingInvoice,
	desiredPostsForDailyAction,
	desiredPostsForSellingInvoice,
	reversedCashPost,
	sumDesiredPosts,
} from '../shared/cashAccounts/cashImpact'
import {
	CASH_ACCOUNT_TYPES,
	CASH_MOVEMENT_TYPES,
	validateCashExchangeInput,
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
				currencyId: 'usd',
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				currencyId: 'usd',
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
				currencyId: 'usd',
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.ONLINE,
				currencyId: 'usd',
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
				currencyId: 'usd',
			}),
		).toEqual([])

		expect(
			desiredPostsForSellingInvoice({
				status: InvoiceStatus.PARTIAL,
				paymentType: InvoicePaymentType.CASH,
				grandTotal: 50,
				paidAmount: 10,
				currencyId: 'usd',
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				currencyId: 'usd',
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
				currencyId: 'usd',
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				currencyId: 'usd',
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
				currencyId: 'usd',
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.ONLINE,
				currencyId: 'usd',
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
				currencyId: 'usd',
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				currencyId: 'usd',
				amount: 15,
				movementType: CASH_MOVEMENT_TYPES.RECEIPT,
			},
		])

		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.PAYMENT_ENTRY,
				amount: 5,
				currencyId: 'usd',
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				currencyId: 'usd',
				amount: -5,
				movementType: CASH_MOVEMENT_TYPES.PAYMENT,
			},
		])

		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.EXPENSE_ENTRY,
				amount: 3,
				currencyId: 'usd',
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				currencyId: 'usd',
				amount: -3,
				movementType: CASH_MOVEMENT_TYPES.EXPENSE,
			},
		])

		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.EMPLOYEE_COST,
				amount: 4,
				currencyId: 'usd',
			}),
		).toEqual([])

		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.OTHER_COST,
				amount: 2,
				currencyId: 'usd',
			}),
		).toEqual([])
	})

	it('posts receipt/payment/expense to the selected cash account', () => {
		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.RECEIPT_ENTRY,
				amount: 20,
				currencyId: 'usd',
				accountType: CASH_ACCOUNT_TYPES.ONLINE,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.ONLINE,
				currencyId: 'usd',
				amount: 20,
				movementType: CASH_MOVEMENT_TYPES.RECEIPT,
			},
		])

		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.PAYMENT_ENTRY,
				amount: 8,
				currencyId: 'usd',
				accountType: CASH_ACCOUNT_TYPES.CASH_RESERVE,
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.CASH_RESERVE,
				currencyId: 'usd',
				amount: -8,
				movementType: CASH_MOVEMENT_TYPES.PAYMENT,
			},
		])

		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.EXPENSE_ENTRY,
				amount: 4,
				currencyId: 'usd',
				accountType: 'not_a_real_account',
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				currencyId: 'usd',
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
					currencyId: 'usd',
					amount: -500,
					movementType: CASH_MOVEMENT_TYPES.TRANSFER,
				},
				{
					accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
					currencyId: 'usd',
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

	it('validates exchange input against the submitted rate snapshot', () => {
		// 100 EUR @ 0.9 per primary → 111.11111111 primary → × 0.972 USD = 108 USD
		const base = {
			accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
			fromCurrencyId: 'eur',
			toCurrencyId: 'usd',
			fromAmount: 100,
			toAmount: 108,
			fromExchangeRateToPrimary: 0.9,
			toExchangeRateToPrimary: 0.972,
		}

		expect(validateCashExchangeInput(base)).toMatchObject({
			fromAmount: 100,
			toAmount: 108,
			fromExchangeRateToPrimary: 0.9,
			toExchangeRateToPrimary: 0.972,
		})

		expect(() =>
			validateCashExchangeInput({ ...base, toCurrencyId: 'eur' }),
		).toThrow('From and To currencies must be different.')

		expect(() => validateCashExchangeInput({ ...base, fromAmount: 0 })).toThrow(
			'Exchange amounts must be greater than zero.',
		)

		expect(() =>
			validateCashExchangeInput({ ...base, toExchangeRateToPrimary: 0 }),
		).toThrow('Exchange rates must be greater than zero.')

		expect(() =>
			validateCashExchangeInput({ ...base, fromExchangeRateToPrimary: NaN }),
		).toThrow('Exchange rates must be greater than zero.')

		expect(() => validateCashExchangeInput({ ...base, toAmount: 120 })).toThrow(
			'Exchange amount does not match the exchange rates.',
		)

		expect(() =>
			validateCashExchangeInput({ ...base, accountType: 'vault' }),
		).toThrow('Cash account type is invalid.')

		const settingsRates = new Map([
			['eur', 0.9],
			['usd', 0.972],
		])

		expect(validateCashExchangeInput({ ...base, settingsRates })).toMatchObject(
			{ toAmount: 108 },
		)

		expect(() =>
			validateCashExchangeInput({
				...base,
				settingsRates: new Map([...settingsRates, ['usd', 1.1]]),
			}),
		).toThrow('Exchange rate does not match currency settings.')

		expect(() =>
			validateCashExchangeInput({
				...base,
				settingsRates: new Map([['eur', 0.9]]),
			}),
		).toThrow('Exchange rate does not match currency settings.')
	})

	it('posts the currency amount that was paid, not a primary conversion', () => {
		expect(
			desiredPostsForDailyAction({
				entryType: DailyActionType.PAYMENT_ENTRY,
				amount: 500,
				currencyId: 'syp',
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				currencyId: 'syp',
				amount: -500,
				movementType: CASH_MOVEMENT_TYPES.PAYMENT,
			},
		])
	})

	it('treats a missing currency balance as zero and will not spend another currency', () => {
		expect(currencyBalanceOf({}, 'syp')).toBe(0)
		expect(currencyBalanceOf({ usd: 100 }, 'syp')).toBe(0)
		expect(debitFitsCurrencyBalance({ usd: 100 }, 'syp', 1)).toBe(false)
		expect(debitFitsCurrencyBalance({ syp: 40 }, 'syp', 40)).toBe(true)
		expect(debitFitsCurrencyBalance({ syp: 10 }, 'syp', 40)).toBe(false)
	})

	it('posts 37 when 40 is tendered against 37 and does not post the change', () => {
		expect(
			allocateCashTenders([{ currencyId: 'usd', tenderedAmount: 40 }], 37, [
				{ currencyId: 'usd', exchangeRate: 1 },
			]),
		).toEqual([
			{
				currencyId: 'usd',
				tenderedAmount: 40,
				appliedAmount: 37,
				changeAmount: 3,
			},
		])

		expect(
			desiredPostsForSellingInvoice({
				status: InvoiceStatus.PAID,
				paymentType: InvoicePaymentType.CASH,
				grandTotal: 37,
				paidAmount: 37,
				currencyId: 'usd',
				tenders: [{ currencyId: 'usd', appliedAmount: 37 }],
			}),
		).toEqual([
			{
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				currencyId: 'usd',
				amount: 37,
				movementType: CASH_MOVEMENT_TYPES.SALE,
			},
		])
	})

	it('reverses the original currency and amount', () => {
		expect(
			reversedCashPost({
				accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
				currencyId: 'syp',
				amount: 12000,
				movementType: CASH_MOVEMENT_TYPES.SALE,
			}),
		).toEqual({
			accountType: CASH_ACCOUNT_TYPES.DAILY_CASH,
			currencyId: 'syp',
			amount: -12000,
			movementType: CASH_MOVEMENT_TYPES.REVERSAL,
		})
	})

	it('ignores drafts', () => {
		expect(
			desiredPostsForSellingInvoice({
				status: InvoiceStatus.DRAFT,
				paymentStatus: InvoicePaymentStatus.PAID,
				paymentType: InvoicePaymentType.CASH,
				grandTotal: 99,
				paidAmount: 99,
				currencyId: 'usd',
			}),
		).toEqual([])
	})
})
