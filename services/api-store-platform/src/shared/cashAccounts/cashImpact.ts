import {
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
	DailyActionType,
} from '../globalEnums'
import {
	CASH_ACCOUNT_TYPES,
	CASH_MOVEMENT_TYPES,
	isCashAccountType,
	type CashAccountType,
	type DesiredCashPost,
} from './types'

const CASH_INFLOW_PAYMENT_TYPES = new Set<string>([
	InvoicePaymentType.CASH,
	InvoicePaymentType.CARD,
])

const CASH_OUTFLOW_PAYMENT_TYPES = new Set<string>([
	InvoicePaymentType.CASH,
	InvoicePaymentType.CARD,
])

const roundPrimary = (amount: number) => Math.round(amount * 1e8) / 1e8

/** Invoice paymentType → ledger account (cash→daily_cash, card→online). */
export const defaultCashAccountForInvoicePayment = (
	paymentType?: string,
): CashAccountType =>
	paymentType === InvoicePaymentType.CARD
		? CASH_ACCOUNT_TYPES.ONLINE
		: CASH_ACCOUNT_TYPES.DAILY_CASH

const isExcludedInvoiceStatus = (status?: string) =>
	status === InvoiceStatus.DRAFT || status === InvoiceStatus.CANCELLED

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

const resolveInvoiceCashAmount = (
	invoice: { status?: string; paymentStatus?: string },
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

/** Selling invoice → ledger posts. */
export const desiredPostsForSellingInvoice = (invoice: {
	status?: string
	paymentStatus?: string
	paymentType?: string
	grandTotal: number
	paidAmount: number
}): DesiredCashPost[] => {
	if (!isIncludedInvoiceStatus(invoice)) return []

	if (invoice.paymentType === InvoicePaymentType.CREDIT) return []

	const paymentType = invoice.paymentType ?? InvoicePaymentType.CASH

	if (!CASH_INFLOW_PAYMENT_TYPES.has(paymentType)) return []

	const amount = roundPrimary(
		resolveInvoiceCashAmount(invoice, invoice.grandTotal, invoice.paidAmount),
	)

	if (amount <= 0) return []

	return [
		{
			accountType: defaultCashAccountForInvoicePayment(paymentType),
			amount,
			movementType: CASH_MOVEMENT_TYPES.SALE,
		},
	]
}

/** Buying invoice → ledger posts (cash→daily_cash, card→online debit). */
export const desiredPostsForBuyingInvoice = (invoice: {
	status?: string
	paymentStatus?: string
	paymentType?: string
	grandTotal: number
	paidAmount: number
}): DesiredCashPost[] => {
	if (!isIncludedInvoiceStatus(invoice)) return []

	if (invoice.paymentType === InvoicePaymentType.CREDIT) return []

	const paymentType = invoice.paymentType ?? InvoicePaymentType.CASH

	if (!CASH_OUTFLOW_PAYMENT_TYPES.has(paymentType)) return []

	const amount = roundPrimary(
		resolveInvoiceCashAmount(invoice, invoice.grandTotal, invoice.paidAmount),
	)

	if (amount <= 0) return []

	return [
		{
			accountType: defaultCashAccountForInvoicePayment(paymentType),
			amount: -amount,
			movementType: CASH_MOVEMENT_TYPES.PURCHASE,
		},
	]
}

const resolveEntryType = (entryType: unknown): string | undefined => {
	if (!entryType) return undefined

	if (typeof entryType === 'string') return entryType

	if (
		typeof entryType === 'object' &&
		entryType !== null &&
		'value' in entryType
	) {
		return String((entryType as { value: unknown }).value)
	}

	return undefined
}

/** Receipt / payment / expense → selected cash account (default Daily Cash). */
export const desiredPostsForDailyAction = (action: {
	entryType?: unknown
	amount: number
	accountType?: string | null
}): DesiredCashPost[] => {
	const entryType = resolveEntryType(action.entryType)
	const amount = roundPrimary(Math.abs(action.amount))

	if (amount <= 0 || !entryType) return []

	const accountType = isCashAccountType(action.accountType)
		? action.accountType
		: CASH_ACCOUNT_TYPES.DAILY_CASH

	if (entryType === DailyActionType.RECEIPT_ENTRY) {
		return [
			{
				accountType,
				amount,
				movementType: CASH_MOVEMENT_TYPES.RECEIPT,
			},
		]
	}

	if (entryType === DailyActionType.PAYMENT_ENTRY) {
		return [
			{
				accountType,
				amount: -amount,
				movementType: CASH_MOVEMENT_TYPES.PAYMENT,
			},
		]
	}

	if (entryType === DailyActionType.EXPENSE_ENTRY) {
		return [
			{
				accountType,
				amount: -amount,
				movementType: CASH_MOVEMENT_TYPES.EXPENSE,
			},
		]
	}

	return []
}

/** Total of signed posts — transfers must net to 0. */
export const sumDesiredPosts = (posts: DesiredCashPost[]) =>
	roundPrimary(posts.reduce((sum, post) => sum + post.amount, 0))
