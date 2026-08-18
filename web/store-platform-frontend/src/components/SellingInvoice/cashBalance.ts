import dayjs from 'dayjs'

import {
	DailyActionType,
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
} from '../../shared/globalEnums'
import type { ApiBuyingInvoice } from '../BuyingInvoice/buyingInvoiceApiMappers'
import {
	convertEntryAmountToPrimary,
	getPrimaryInvoiceCurrencyAmounts,
	type DisplayCurrencyOption,
} from './currencyDisplay'
import { getDailyActionEntryTypeValue } from './entryTableMappers'
import type { ApiSellingInvoice } from './invoiceApiMappers'

export const CASH_BALANCE_ALL_TIME_FROM = '2026-06-30'

const CASH_INFLOW_PAYMENT_TYPES = new Set<string>([
	InvoicePaymentType.CASH,
	InvoicePaymentType.CARD,
])

export interface CashBalanceDateRange {
	dateFrom?: string
	dateTo?: string
}

const parseDailyActionAmount = (dailyAction: DailyAction) => {
	const rawAmount = dailyAction.singleUnitPrice ?? dailyAction.totalPrice ?? '0'
	const amount = parseFloat(String(rawAmount).replace(/,/g, ''))
	return Number.isFinite(amount) ? amount : 0
}

const isExcludedInvoiceStatus = (status?: string) =>
	status === InvoiceStatus.DRAFT || status === InvoiceStatus.CANCELLED

const isInvoiceInRange = (
	issuedAt: string | undefined,
	createdAt: string | undefined,
	range: CashBalanceDateRange,
) => {
	const dateKey = issuedAt ?? createdAt
	if (!dateKey) return false

	const date = dayjs(dateKey)
	if (!date.isValid()) return false

	if (range.dateFrom && date.isBefore(dayjs(range.dateFrom), 'day')) {
		return false
	}

	if (range.dateTo && date.isAfter(dayjs(range.dateTo), 'day')) {
		return false
	}

	return true
}

const isIncludedInvoiceStatus = (invoice: {
	status?: string
	paymentStatus?: string
}) => {
	if (isExcludedInvoiceStatus(invoice.status)) return false

	return (
		invoice.status === InvoiceStatus.PAID ||
		invoice.status === InvoiceStatus.PARTIAL ||
		invoice.status === InvoiceStatus.CONFIRMED ||
		invoice.paymentStatus === InvoicePaymentStatus.PAID ||
		invoice.paymentStatus === InvoicePaymentStatus.PARTIAL
	)
}

const getInvoiceCashAmount = (
	invoice: {
		status?: string
		paymentStatus?: string
	},
	grandTotal: number,
	paidAmount: number,
) => {
	if (
		invoice.status === InvoiceStatus.PARTIAL ||
		invoice.paymentStatus === InvoicePaymentStatus.PARTIAL
	) {
		return paidAmount
	}

	return grandTotal
}

const getSellingCashImpact = (
	invoice: ApiSellingInvoice,
	options: DisplayCurrencyOption[],
) => {
	if (!isIncludedInvoiceStatus(invoice)) return 0
	if (invoice.paymentType === InvoicePaymentType.CREDIT) return 0
	if (!CASH_INFLOW_PAYMENT_TYPES.has(invoice.paymentType ?? InvoicePaymentType.CASH)) return 0

	const { grandTotal, paidAmount, currencyId } =
		getPrimaryInvoiceCurrencyAmounts(invoice)
	const amount = getInvoiceCashAmount(invoice, grandTotal, paidAmount)

	if (amount <= 0) return 0

	return convertEntryAmountToPrimary(amount, currencyId, options)
}

const getBuyingCashImpact = (
	invoice: ApiBuyingInvoice,
	options: DisplayCurrencyOption[],
) => {
	if (!isIncludedInvoiceStatus(invoice)) return 0
	if (invoice.paymentType === InvoicePaymentType.CREDIT) return 0
	if ((invoice.paymentType ?? InvoicePaymentType.CASH) !== InvoicePaymentType.CASH) return 0

	const { grandTotal, paidAmount, currencyId } =
		getPrimaryInvoiceCurrencyAmounts(invoice)
	const amount = getInvoiceCashAmount(invoice, grandTotal, paidAmount)

	if (amount <= 0) return 0

	return convertEntryAmountToPrimary(amount, currencyId, options)
}

const getDailyActionCashImpact = (
	dailyAction: DailyAction,
	options: DisplayCurrencyOption[],
) => {
	const entryType = getDailyActionEntryTypeValue(dailyAction.entryType)
	const amount = convertEntryAmountToPrimary(
		parseDailyActionAmount(dailyAction),
		dailyAction.currencyId,
		options,
	)

	if (entryType === DailyActionType.RECEIPT_ENTRY) return amount
	if (entryType === DailyActionType.PAYMENT_ENTRY) return -amount
	if (entryType === DailyActionType.EXPENSE_ENTRY) return -amount

	return 0
}

export const calculateCashBalance = ({
	dailyActions,
	sellingInvoices,
	buyingInvoices,
	range,
	displayCurrencyOptions,
}: {
	dailyActions: DailyAction[]
	sellingInvoices: ApiSellingInvoice[]
	buyingInvoices: ApiBuyingInvoice[]
	range: CashBalanceDateRange
	displayCurrencyOptions: DisplayCurrencyOption[]
}) => {
	let balance = 0

	for (const dailyAction of dailyActions) {
		balance += getDailyActionCashImpact(dailyAction, displayCurrencyOptions)
	}

	for (const invoice of sellingInvoices) {
		if (!isInvoiceInRange(invoice.issuedAt, invoice.createdAt, range)) {
			continue
		}

		balance += getSellingCashImpact(invoice, displayCurrencyOptions)
	}

	for (const invoice of buyingInvoices) {
		if (!isInvoiceInRange(invoice.issuedAt, invoice.createdAt, range)) {
			continue
		}

		balance -= getBuyingCashImpact(invoice, displayCurrencyOptions)
	}

	return balance
}

// // ponytail: dev-only sanity check; extend if formula branches grow
// if (import.meta.env.DEV) {
// 	const options: DisplayCurrencyOption[] = [
// 		{ currencyId: 'primary', label: 'SYP', name: 'SYP', exchangeRate: 1 },
// 	]
// 	const receipt: DailyAction = {
// 		actionId: 'r1',
// 		entryType: DailyActionType.RECEIPT_ENTRY,
// 		singleUnitPrice: '100',
// 		currencyId: 'primary',
// 		invoiceDate: '2026-07-01',
// 	}
// 	const payment: DailyAction = {
// 		actionId: 'p1',
// 		entryType: DailyActionType.PAYMENT_ENTRY,
// 		singleUnitPrice: '40',
// 		currencyId: 'primary',
// 		invoiceDate: '2026-07-01',
// 	}

// 	console.assert(
// 		calculateCashBalance({
// 			dailyActions: [receipt, payment],
// 			sellingInvoices: [],
// 			buyingInvoices: [],
// 			range: { dateFrom: '2026-07-01', dateTo: '2026-07-01' },
// 			displayCurrencyOptions: options,
// 		}) === 60,
// 		'cashBalance self-check: receipts - payments',
// 	)
// }
