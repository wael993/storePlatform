import { BuyingInvoice } from '../models/BuyingInvoices'
import { pgFind } from '../db/mongoQuery'
import { CashLedgerEntry } from '../models/CashLedgerEntry'
import { DailyAction } from '../models/DailyAction'
import { Employee } from '../models/Employee'
import { Invoice } from '../models/Invoice'

export const DeleteBlockReason = {
	invoice: 'invoice',
	buyingInvoice: 'buyingInvoice',
	project: 'project',
	stockMoving: 'stockMoving',
	dailyAction: 'dailyAction',
	products: 'products',
	primaryCurrency: 'primaryCurrency',
	cashLedger: 'cashLedger',
	employee: 'employee',
	offline: 'offline',
} as const

export type DeleteBlockReasonCode =
	(typeof DeleteBlockReason)[keyof typeof DeleteBlockReason]

export const stampDeleteAvailability = <T extends object>(
	rows: T[],
	idOf: (row: T) => string,
	blocked: Map<string, string>,
) =>
	rows.map(row => {
		const reason = blocked.get(idOf(row)) ?? null

		return {
			...row,
			isDeletable: reason == null,
			deleteBlockReason: reason,
		}
	})

const markFirst = (
	blocked: Map<string, string>,
	id: string | undefined,
	reason: string,
) => {
	if (id && !blocked.has(id)) blocked.set(id, reason)
}

const currencyQuery = (ids: string[]) => ({
	$or: [
		{ invoiceCurrencyId: { $in: ids } },
		{ 'currencyAmounts.currencyId': { $in: ids } },
		{ 'tenders.currencyId': { $in: ids } },
	],
})

type CurrencyRow = {
	invoiceCurrencyId?: string
	currencyAmounts?: Array<{ currencyId?: string }>
	tenders?: Array<{ currencyId?: string }>
}

const markCurrencyRow = (
	blocked: Map<string, string>,
	row: CurrencyRow,
	reason: string,
) => {
	markFirst(blocked, row.invoiceCurrencyId, reason)

	for (const amount of row.currencyAmounts ?? []) {
		markFirst(blocked, amount.currencyId, reason)
	}

	for (const tender of row.tenders ?? []) {
		markFirst(blocked, tender.currencyId, reason)
	}
}

export const findCurrencyDeleteBlocks = async (
	tenantId: string,
	currencyIds: string[],
) => {
	const ids = [...new Set(currencyIds.filter(Boolean))]
	const blocked = new Map<string, string>()

	if (ids.length === 0) return blocked

	const [invoices, buying, actions, ledger, employees] = await Promise.all([
		pgFind(Invoice, tenantId, currencyQuery(ids), {
			select: { invoiceCurrencyId: 1, currencyAmounts: 1, tenders: 1 },
		}) as unknown as Promise<CurrencyRow[]>,
		pgFind(BuyingInvoice, tenantId, currencyQuery(ids), {
			select: { invoiceCurrencyId: 1, currencyAmounts: 1, tenders: 1 },
		}) as unknown as Promise<CurrencyRow[]>,
		pgFind(
			DailyAction,
			tenantId,
			{ currencyId: { $in: ids } },
			{ select: { currencyId: 1 } },
		),
		pgFind(
			CashLedgerEntry,
			tenantId,
			{ currencyId: { $in: ids } },
			{ select: { currencyId: 1 } },
		),
		pgFind(
			Employee,
			tenantId,
			{
				$or: [
					{ 'salaries.currencyId': { $in: ids } },
					{ 'payouts.currencyId': { $in: ids } },
				],
			},
			{ select: { salaries: 1, payouts: 1 } },
		),
	])

	for (const row of invoices) {
		markCurrencyRow(blocked, row, DeleteBlockReason.invoice)
	}

	for (const row of buying) {
		markCurrencyRow(blocked, row, DeleteBlockReason.buyingInvoice)
	}

	for (const row of actions) {
		markFirst(blocked, row.currencyId, DeleteBlockReason.dailyAction)
	}

	for (const row of ledger) {
		markFirst(blocked, row.currencyId, DeleteBlockReason.cashLedger)
	}

	for (const employee of employees) {
		for (const salary of employee.salaries ?? []) {
			markFirst(blocked, salary.currencyId, DeleteBlockReason.employee)
		}

		for (const payout of employee.payouts ?? []) {
			markFirst(blocked, payout.currencyId, DeleteBlockReason.employee)
		}
	}

	return blocked
}

export const findExpenseDeleteBlocks = async (
	tenantId: string,
	expenses: Array<{ expenseId: string; internalCode?: string }>,
) => {
	const blocked = new Map<string, string>()
	const keys = [
		...new Set(
			expenses.flatMap(expense =>
				[expense.expenseId, expense.internalCode].filter(Boolean),
			),
		),
	] as string[]

	if (keys.length === 0) return blocked

	const actions = await pgFind(
		DailyAction,
		tenantId,
		{ expenseId: { $in: keys } },
		{ select: { expenseId: 1 } },
	)
	const used = new Set(
		actions
			.map(action => action.expenseId)
			.filter((id): id is string => Boolean(id)),
	)

	for (const expense of expenses) {
		if (
			used.has(expense.expenseId) ||
			(expense.internalCode && used.has(expense.internalCode))
		) {
			blocked.set(expense.expenseId, DeleteBlockReason.dailyAction)
		}
	}

	return blocked
}
