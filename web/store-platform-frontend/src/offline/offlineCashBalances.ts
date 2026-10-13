import { amountToPrimary, type CostCurrencyRate } from 'store-domain'
import {
	DailyActionType,
	InvoicePaymentStatus,
	InvoicePaymentType,
	InvoiceStatus,
} from '../shared/globalEnums'
import { getPrimaryInvoiceCurrencyAmounts } from '../components/SellingInvoice/currencyDisplay'
import { getSyncMeta, offlineDb, setSyncMeta } from './db'
import { getWarehouseScopeIds } from '../shared/warehouseScope'

const CASH_BALANCES_META_KEY = 'cashAccountBalances'

const CASH_ACCOUNT_TYPES = new Set(['daily_cash', 'cash_reserve', 'online'])

export type CashBalances = {
	accounts: Array<{ type: string; name: string; balance: number }>
	total: number
}

const roundPrimary = (amount: number) => Math.round(amount * 1e8) / 1e8

const accountForPayment = (paymentType?: string) =>
	paymentType === InvoicePaymentType.CARD ? 'online' : 'daily_cash'

const invoiceCashAmount = (invoice: {
	status?: string
	paymentStatus?: string
	grandTotal: number
	paidAmount: number
}) => {
	if (
		invoice.status === InvoiceStatus.PARTIAL ||
		invoice.paymentStatus === InvoicePaymentStatus.PARTIAL
	) {
		return invoice.paidAmount
	}

	return invoice.grandTotal
}

/** Mirrors `desiredPostsForSellingInvoice` / buying / daily-action posts. */
const postsForInvoice = (
	invoice: {
		status?: string
		paymentStatus?: string
		paymentType?: string
		warehouseId?: string
		currencyAmounts?: Parameters<
			typeof getPrimaryInvoiceCurrencyAmounts
		>[0]['currencyAmounts']
		amount?: number
		paidAmount?: number
	},
	sign: 1 | -1,
) => {
	if (
		invoice.status === InvoiceStatus.DRAFT ||
		invoice.status === InvoiceStatus.CANCELLED
	) {
		return []
	}

	const included =
		invoice.status === InvoiceStatus.PAID ||
		invoice.status === InvoiceStatus.PARTIAL ||
		invoice.status === InvoiceStatus.CONFIRMED ||
		invoice.paymentStatus === InvoicePaymentStatus.PAID ||
		invoice.paymentStatus === InvoicePaymentStatus.PARTIAL

	if (!included || invoice.paymentType === InvoicePaymentType.CREDIT) return []

	const paymentType = invoice.paymentType ?? InvoicePaymentType.CASH
	if (
		paymentType !== InvoicePaymentType.CASH &&
		paymentType !== InvoicePaymentType.CARD
	) {
		return []
	}

	const primary = getPrimaryInvoiceCurrencyAmounts(invoice)
	const amount = roundPrimary(
		invoiceCashAmount({
			status: invoice.status,
			paymentStatus: invoice.paymentStatus,
			grandTotal: primary.grandTotal,
			paidAmount: primary.paidAmount,
		}),
	)

	if (amount <= 0) return []

	return [
		{ accountType: accountForPayment(paymentType), amount: sign * amount },
	]
}

const entryAmount = (
	payload: {
		singleUnitPrice?: unknown
		totalPrice?: unknown
		currencyId?: string
	},
	rates: readonly CostCurrencyRate[],
) => {
	const raw = Number(
		String(payload.singleUnitPrice ?? payload.totalPrice ?? '0').replace(
			/,/g,
			'',
		),
	)

	if (!Number.isFinite(raw)) return 0

	return amountToPrimary(Math.abs(raw), payload.currencyId ?? null, rates)
}

const postsForDailyAction = (
	payload: {
		entryType?: unknown
		warehouseId?: string
		cashAccountType?: string
		singleUnitPrice?: unknown
		totalPrice?: unknown
		currencyId?: string
	},
	rates: readonly CostCurrencyRate[],
) => {
	const entryType =
		typeof payload.entryType === 'string' ? payload.entryType : undefined
	const amount = entryAmount(payload, rates)

	if (amount <= 0 || !entryType) return []

	const accountType = CASH_ACCOUNT_TYPES.has(payload.cashAccountType ?? '')
		? (payload.cashAccountType as string)
		: 'daily_cash'
	const signed =
		entryType === DailyActionType.RECEIPT_ENTRY
			? amount
			: entryType === DailyActionType.PAYMENT_ENTRY ||
				  entryType === DailyActionType.EXPENSE_ENTRY
				? -amount
				: 0

	if (signed === 0) return []

	return [{ accountType, amount: signed }]
}

export const cashPostsFromPendingCreate = (
	entity: string,
	payload: Record<string, unknown>,
	rates: readonly CostCurrencyRate[],
) => {
	if (entity === 'invoice') return postsForInvoice(payload, 1)
	if (entity === 'buyingInvoice') return postsForInvoice(payload, -1)
	if (entity === 'dailyAction') return postsForDailyAction(payload, rates)
	return []
}

export const applyPendingCash = (
	snapshot: CashBalances,
	posts: Array<{ accountType: string; amount: number }>,
): CashBalances => {
	const accounts = snapshot.accounts.map(account => ({ ...account }))
	const byType = new Map(accounts.map(account => [account.type, account]))

	for (const post of posts) {
		const row = byType.get(post.accountType)
		if (!row) continue
		row.balance = roundPrimary(row.balance + post.amount)
	}

	return {
		accounts,
		total: roundPrimary(
			accounts.reduce((sum, account) => sum + account.balance, 0),
		),
	}
}

export const rememberCashBalances = async (data: unknown) => {
	if (!data || typeof data !== 'object' || !('accounts' in data)) return
	await setSyncMeta(CASH_BALANCES_META_KEY, JSON.stringify(data))
}

/**
 * Last online balances for the scope that was open when they were saved,
 * plus unsynced creates. Edits of already-synced invoices and cash transfers
 * stay on the server until the next sync.
 */
export const readOfflineCashBalances = async (
	rates: readonly CostCurrencyRate[],
): Promise<CashBalances | null> => {
	const raw = await getSyncMeta(CASH_BALANCES_META_KEY)
	if (!raw) return null

	const snapshot = JSON.parse(raw) as CashBalances
	if (!Array.isArray(snapshot.accounts)) return null

	const pending = await offlineDb.outbox
		.filter(
			entry =>
				entry.status !== 'completed' &&
				entry.operation === 'create' &&
				(entry.entity === 'invoice' ||
					entry.entity === 'buyingInvoice' ||
					entry.entity === 'dailyAction'),
		)
		.toArray()

	const scope = new Set(getWarehouseScopeIds())
	const posts = pending.flatMap(entry => {
		const payload = (entry.payload ?? {}) as Record<string, unknown>
		const warehouseId = payload.warehouseId
		if (
			scope.size === 0 ||
			typeof warehouseId !== 'string' ||
			!scope.has(warehouseId)
		) {
			return []
		}

		return cashPostsFromPendingCreate(entry.entity, payload, rates)
	})

	return applyPendingCash(snapshot, posts)
}
