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

export type InvoiceCashTender = {
	currencyId: string
	appliedAmount: number
}

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

const resolveInvoiceAccountType = (
	paymentType: string | undefined,
	cashAccountType?: string | null,
): CashAccountType =>
	isCashAccountType(cashAccountType)
		? cashAccountType
		: defaultCashAccountForInvoicePayment(paymentType)

/** Same account and currency, negated amount. Does not look up a new rate. */
export const reversedCashPost = (post: DesiredCashPost): DesiredCashPost => {
	const currencyId = post.currencyId?.trim()

	if (!currencyId) {
		throw new Error('Cash reversal requires the original currencyId.')
	}

	return {
		accountType: post.accountType,
		currencyId,
		amount: roundPrimary(-post.amount),
		movementType: CASH_MOVEMENT_TYPES.REVERSAL,
	}
}

const postsForInvoiceTenders = (
	accountType: CashAccountType,
	tenders: readonly InvoiceCashTender[] | undefined,
	movementType: DesiredCashPost['movementType'],
	sign: 1 | -1,
): DesiredCashPost[] | null => {
	const kept = (tenders ?? []).filter(
		tender => tender.currencyId?.trim() && tender.appliedAmount > 0,
	)

	if (kept.length === 0) return null

	return kept.map(tender => ({
		accountType,
		currencyId: tender.currencyId.trim(),
		amount: sign * roundPrimary(tender.appliedAmount),
		movementType,
	}))
}

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

/** Selling invoice → ledger posts. Change is not included. */
export const desiredPostsForSellingInvoice = (invoice: {
	status?: string
	paymentStatus?: string
	paymentType?: string
	cashAccountType?: string | null
	grandTotal: number
	paidAmount: number
	currencyId?: string | null
	tenders?: readonly InvoiceCashTender[]
}): DesiredCashPost[] => {
	if (!isIncludedInvoiceStatus(invoice)) return []

	if (invoice.paymentType === InvoicePaymentType.CREDIT) return []

	const paymentType = invoice.paymentType ?? InvoicePaymentType.CASH

	if (!CASH_INFLOW_PAYMENT_TYPES.has(paymentType)) return []

	const accountType = resolveInvoiceAccountType(
		paymentType,
		invoice.cashAccountType,
	)
	const fromTenders = postsForInvoiceTenders(
		accountType,
		invoice.tenders,
		CASH_MOVEMENT_TYPES.SALE,
		1,
	)

	if (fromTenders) return fromTenders

	const currencyId = invoice.currencyId?.trim()
	const amount = roundPrimary(
		resolveInvoiceCashAmount(invoice, invoice.grandTotal, invoice.paidAmount),
	)

	if (!currencyId || amount <= 0) return []

	return [
		{
			accountType,
			currencyId,
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
	cashAccountType?: string | null
	grandTotal: number
	paidAmount: number
	currencyId?: string | null
	tenders?: readonly InvoiceCashTender[]
}): DesiredCashPost[] => {
	if (!isIncludedInvoiceStatus(invoice)) return []

	if (invoice.paymentType === InvoicePaymentType.CREDIT) return []

	const paymentType = invoice.paymentType ?? InvoicePaymentType.CASH

	if (!CASH_OUTFLOW_PAYMENT_TYPES.has(paymentType)) return []

	const accountType = resolveInvoiceAccountType(
		paymentType,
		invoice.cashAccountType,
	)
	const fromTenders = postsForInvoiceTenders(
		accountType,
		invoice.tenders,
		CASH_MOVEMENT_TYPES.PURCHASE,
		-1,
	)

	if (fromTenders) return fromTenders

	const currencyId = invoice.currencyId?.trim()
	const amount = roundPrimary(
		resolveInvoiceCashAmount(invoice, invoice.grandTotal, invoice.paidAmount),
	)

	if (!currencyId || amount <= 0) return []

	return [
		{
			accountType,
			currencyId,
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
	/** Amount in `currencyId`, not converted. */
	amount: number
	currencyId?: string | null
	accountType?: string | null
}): DesiredCashPost[] => {
	const entryType = resolveEntryType(action.entryType)
	const amount = roundPrimary(Math.abs(action.amount))
	const currencyId = action.currencyId?.trim()

	if (amount <= 0 || !entryType || !currencyId) return []

	const accountType = isCashAccountType(action.accountType)
		? action.accountType
		: CASH_ACCOUNT_TYPES.DAILY_CASH

	if (entryType === DailyActionType.RECEIPT_ENTRY) {
		return [
			{
				accountType,
				currencyId,
				amount,
				movementType: CASH_MOVEMENT_TYPES.RECEIPT,
			},
		]
	}

	if (entryType === DailyActionType.PAYMENT_ENTRY) {
		return [
			{
				accountType,
				currencyId,
				amount: -amount,
				movementType: CASH_MOVEMENT_TYPES.PAYMENT,
			},
		]
	}

	if (entryType === DailyActionType.EXPENSE_ENTRY) {
		return [
			{
				accountType,
				currencyId,
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
