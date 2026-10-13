/**
 * Seed cash accounts, stamp legacy ledger rows with the primary currencyId,
 * and rebuild per-currency balances from the ledger.
 *
 * Existing ledger amounts stay as they were posted. Invoices that already
 * have ledger rows are not rebuilt from currencyAmounts.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-cash-accounts.ts
 *   npx ts-node src/scripts/migrate-cash-accounts.ts --tenant=TENANT_ID
 *   npx ts-node src/scripts/migrate-cash-accounts.ts --reserve=5000
 *
 * --reserve=N sets Cash Reserve opening balance in the primary currency
 * (explicit only, and only when that opening has no ledger yet).
 */
import mongoose from 'mongoose'
import { config } from '../config/config'
import { BuyingInvoice } from '../models/BuyingInvoices'
import { CashAccount } from '../models/CashAccount'
import { CashLedgerEntry } from '../models/CashLedgerEntry'
import { DailyAction } from '../models/DailyAction'
import { Invoice } from '../models/Invoice'
import { Warehouse } from '../models/Warehaus'
import Tenant from '../models/Tenant'
import CurrencySettings from '../models/CurrencySettings'
import {
	ensureCashAccountsForWarehouse,
	postOpeningBalance,
	syncCashEffectsForReference,
} from '../shared/cashAccounts/ledgerService'
import {
	desiredPostsForBuyingInvoice,
	desiredPostsForDailyAction,
	desiredPostsForSellingInvoice,
} from '../shared/cashAccounts/cashImpact'
import {
	CASH_ACCOUNT_TYPES,
	CASH_MOVEMENT_TYPES,
	CASH_REFERENCE_TYPES,
} from '../shared/cashAccounts/types'
import {
	loadCashCurrencyRates,
	primaryInvoiceTotals,
} from '../shared/cashAccounts/posting'

const CASH_ENTRY_TYPES = new Set([
	'RECEIPT_ENTRY',
	'PAYMENT_ENTRY',
	'EXPENSE_ENTRY',
])

const parseArg = (name: string) => {
	const prefix = `--${name}=`
	const hit = process.argv.find(arg => arg.startsWith(prefix))

	return hit ? hit.slice(prefix.length) : undefined
}

const asFiniteNumber = (value: unknown) => {
	const amount = typeof value === 'number' ? value : Number(value)

	return Number.isFinite(amount) ? amount : 0
}

const roundCash = (amount: number) => Math.round(amount * 1e8) / 1e8

const parseDailyActionAmount = (action: {
	singleUnitPrice?: string
	totalPrice?: string
}) => {
	const raw = action.singleUnitPrice ?? action.totalPrice ?? '0'
	const amount = parseFloat(String(raw).replace(/,/g, ''))

	return Number.isFinite(amount) ? amount : 0
}

const hasLedger = (
	tenantId: string,
	referenceType: string,
	referenceId: string,
) =>
	CashLedgerEntry.collection.countDocuments({
		tenantId,
		referenceType,
		referenceId,
	})

const main = async () => {
	const tenantFilter = parseArg('tenant')
	const reserveRaw = parseArg('reserve')
	const reserveAmount =
		reserveRaw !== undefined ? asFiniteNumber(reserveRaw) : undefined

	await mongoose.connect(config.mongoDB.connectionString, {
		dbName: config.mongoDB.databaseName,
	})

	const tenants = await Tenant.find(
		tenantFilter ? { tenantId: tenantFilter } : {},
	)
		.select('tenantId')
		.lean()

	let seededWarehouses = 0
	let stampedLedger = 0
	let syncedSelling = 0
	let syncedBuying = 0
	let syncedEntries = 0
	let stampedRates = 0

	for (const tenant of tenants) {
		const tenantId = tenant.tenantId
		const settings = await CurrencySettings.findOne({ tenantId })
			.select('primaryCurrency')
			.lean()
		const primaryCurrencyId = settings?.primaryCurrency?.currencyId?.trim()

		if (!primaryCurrencyId) continue

		const cashRates = await loadCashCurrencyRates(tenantId)
		const warehouses = await Warehouse.collection
			.find({ tenantId })
			.project({ warehouseId: 1 })
			.toArray()

		for (const warehouse of warehouses) {
			await ensureCashAccountsForWarehouse(
				tenantId,
				String(warehouse.warehouseId),
			)

			seededWarehouses += 1
		}

		const stamped = await CashLedgerEntry.collection.updateMany(
			{
				tenantId,
				$or: [
					{ currencyId: { $exists: false } },
					{ currencyId: null },
					{ currencyId: '' },
				],
			},
			{ $set: { currencyId: primaryCurrencyId } },
		)

		stampedLedger += stamped.modifiedCount ?? 0

		const invoices = await Invoice.collection.find({ tenantId }).toArray()

		for (const invoice of invoices) {
			const warehouseId = String(invoice.warehouseId ?? '')
			const invoiceId = String(invoice.invoiceId ?? '')

			if (!warehouseId || !invoiceId) continue

			if (
				await hasLedger(
					tenantId,
					CASH_REFERENCE_TYPES.SELLING_INVOICE,
					invoiceId,
				)
			) {
				continue
			}

			const currencyAmounts = Array.isArray(invoice.currencyAmounts)
				? (invoice.currencyAmounts as Array<{
						currencyId?: string
						isPrimary?: boolean
						amount?: number
						paidAmount?: number
					}>)
				: []
			const primary =
				currencyAmounts.find(amount => amount.isPrimary) ?? currencyAmounts[0]

			if (!primary?.currencyId) continue

			const { grandTotal, paidAmount } = primaryInvoiceTotals(currencyAmounts, {
				amount: asFiniteNumber(invoice.amount),
				paidAmount: asFiniteNumber(invoice.paidAmount),
			})

			await syncCashEffectsForReference({
				tenantId,
				warehouseId,
				referenceType: CASH_REFERENCE_TYPES.SELLING_INVOICE,
				referenceId: invoiceId,
				desired: desiredPostsForSellingInvoice({
					status: invoice.status as string | undefined,
					paymentStatus: invoice.paymentStatus as string | undefined,
					paymentType: invoice.paymentType as string | undefined,
					currencyId: primary.currencyId,
					grandTotal,
					paidAmount,
				}),
				reason: 'Historical migration',
			})

			syncedSelling += 1
		}

		const buyingInvoices = await BuyingInvoice.collection
			.find({ tenantId })
			.toArray()

		for (const invoice of buyingInvoices) {
			const warehouseId = String(invoice.warehouseId ?? '')
			const buyingInvoiceId = String(invoice.buyingInvoiceId ?? '')

			if (!warehouseId || !buyingInvoiceId) continue

			if (
				await hasLedger(
					tenantId,
					CASH_REFERENCE_TYPES.BUYING_INVOICE,
					buyingInvoiceId,
				)
			) {
				continue
			}

			const currencyAmounts = Array.isArray(invoice.currencyAmounts)
				? (invoice.currencyAmounts as Array<{
						currencyId?: string
						isPrimary?: boolean
						amount?: number
						paidAmount?: number
					}>)
				: []
			const primary =
				currencyAmounts.find(amount => amount.isPrimary) ?? currencyAmounts[0]

			if (!primary?.currencyId) continue

			const { grandTotal, paidAmount } = primaryInvoiceTotals(currencyAmounts, {
				amount: asFiniteNumber(invoice.amount),
				paidAmount: asFiniteNumber(invoice.paidAmount),
			})

			await syncCashEffectsForReference({
				tenantId,
				warehouseId,
				referenceType: CASH_REFERENCE_TYPES.BUYING_INVOICE,
				referenceId: buyingInvoiceId,
				desired: desiredPostsForBuyingInvoice({
					status: invoice.status as string | undefined,
					paymentStatus: invoice.paymentStatus as string | undefined,
					paymentType: invoice.paymentType as string | undefined,
					currencyId: primary.currencyId,
					grandTotal,
					paidAmount,
				}),
				reason: 'Historical migration',
			})

			syncedBuying += 1
		}

		const dailyActions = await DailyAction.collection
			.find({ tenantId })
			.toArray()

		for (const action of dailyActions) {
			const warehouseId = String(action.warehouseId ?? '')
			const actionId = String(action.actionId ?? '')

			if (!warehouseId || !actionId) continue

			if (
				await hasLedger(tenantId, CASH_REFERENCE_TYPES.DAILY_ACTION, actionId)
			) {
				continue
			}

			const currencyId =
				typeof action.currencyId === 'string' ? action.currencyId : ''
			const desired = desiredPostsForDailyAction({
				entryType: action.entryType,
				amount: parseDailyActionAmount({
					singleUnitPrice:
						typeof action.singleUnitPrice === 'string'
							? action.singleUnitPrice
							: undefined,
					totalPrice:
						typeof action.totalPrice === 'string'
							? action.totalPrice
							: undefined,
				}),
				currencyId,
				accountType:
					typeof action.cashAccountType === 'string'
						? action.cashAccountType
						: undefined,
			})

			await syncCashEffectsForReference({
				tenantId,
				warehouseId,
				referenceType: CASH_REFERENCE_TYPES.DAILY_ACTION,
				referenceId: actionId,
				desired,
				reason: 'Historical migration',
			})

			syncedEntries += 1
		}

		if (reserveAmount !== undefined && reserveAmount > 0) {
			for (const warehouse of warehouses) {
				const warehouseId = String(warehouse.warehouseId)
				const referenceId = `${warehouseId}:${CASH_ACCOUNT_TYPES.CASH_RESERVE}`

				if (
					await hasLedger(tenantId, CASH_REFERENCE_TYPES.OPENING, referenceId)
				) {
					continue
				}

				await postOpeningBalance({
					tenantId,
					warehouseId,
					accountType: CASH_ACCOUNT_TYPES.CASH_RESERVE,
					amount: reserveAmount,
					currencyId: primaryCurrencyId,
					reason: 'Migration opening balance for Cash Reserve',
				})
			}
		}

		const ledgerRows = await CashLedgerEntry.collection
			.find({ tenantId })
			.toArray()
		const reversedIds = new Set(
			ledgerRows
				.map(row => row.reversesLedgerEntryId)
				.filter((id): id is string => typeof id === 'string' && id.length > 0),
		)
		const balancesByAccount = new Map<string, Record<string, number>>()

		for (const row of ledgerRows) {
			if (row.movementType === CASH_MOVEMENT_TYPES.REVERSAL) continue

			if (reversedIds.has(String(row.ledgerEntryId))) continue

			const currencyId = String(row.currencyId ?? '')
			const cashAccountId = String(row.cashAccountId ?? '')

			if (!currencyId || !cashAccountId) continue

			const balances = balancesByAccount.get(cashAccountId) ?? {}

			balances[currencyId] = roundCash(
				(balances[currencyId] ?? 0) + asFiniteNumber(row.amount),
			)

			balancesByAccount.set(cashAccountId, balances)
		}

		const accounts = await CashAccount.collection.find({ tenantId }).toArray()

		for (const account of accounts) {
			await CashAccount.collection.updateOne(
				{ _id: account._id },
				{
					$set: {
						balances:
							balancesByAccount.get(String(account.cashAccountId)) ?? {},
					},
					$unset: { balance: '' },
				},
			)
		}

		for (const action of dailyActions) {
			if (!CASH_ENTRY_TYPES.has(String(action.entryType))) continue

			if (typeof action.exchangeRateToPrimary === 'number') continue

			const currencyId =
				typeof action.currencyId === 'string' ? action.currencyId : ''
			const rate =
				cashRates.find(row => row.currencyId === currencyId)?.exchangeRate ?? 1

			await DailyAction.collection.updateOne(
				{ _id: action._id },
				{ $set: { exchangeRateToPrimary: rate } },
			)

			stampedRates += 1
		}
	}

	console.log(
		JSON.stringify(
			{
				tenants: tenants.length,
				seededWarehouses,
				stampedLedger,
				syncedSelling,
				syncedBuying,
				syncedEntries,
				stampedRates,
				reserveAmount: reserveAmount ?? null,
			},
			null,
			2,
		),
	)

	await mongoose.disconnect()
}

main().catch(error => {
	console.error(error)
	process.exit(1)
})
