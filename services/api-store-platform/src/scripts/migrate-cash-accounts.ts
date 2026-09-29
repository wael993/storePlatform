/**
 * Seed CashAccount rows for every warehouse and optionally backfill ledger
 * from existing invoices / daily actions.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-cash-accounts.ts
 *   npx ts-node src/scripts/migrate-cash-accounts.ts --tenant=TENANT_ID
 *   npx ts-node src/scripts/migrate-cash-accounts.ts --reserve=5000
 *
 * --reserve=N sets Cash Reserve opening balance for each warehouse (explicit only).
 * Migration is idempotent via ledger idempotencyKey / syncCashEffectsForReference.
 */
import mongoose from 'mongoose'
import { config } from '../config/config'
import { BuyingInvoice } from '../models/BuyingInvoices'
import { DailyAction } from '../models/DailyAction'
import { Invoice } from '../models/Invoice'
import { Warehouse } from '../models/Warehaus'
import Tenant from '../models/Tenant'
import {
	ensureCashAccountsForWarehouse,
	postOpeningBalance,
} from '../shared/cashAccounts/ledgerService'
import {
	desiredPostsForBuyingInvoice,
	desiredPostsForDailyAction,
	desiredPostsForSellingInvoice,
} from '../shared/cashAccounts/cashImpact'
import { syncCashEffectsForReference } from '../shared/cashAccounts/ledgerService'
import {
	CASH_ACCOUNT_TYPES,
	CASH_REFERENCE_TYPES,
} from '../shared/cashAccounts/types'
import { primaryInvoiceTotals, loadCashCurrencyRates, toPrimaryCashAmount } from '../shared/cashAccounts/posting'

const parseArg = (name: string) => {
	const prefix = `--${name}=`
	const hit = process.argv.find(arg => arg.startsWith(prefix))

	return hit ? hit.slice(prefix.length) : undefined
}

const asFiniteNumber = (value: unknown) => {
	const amount = typeof value === 'number' ? value : Number(value)

	return Number.isFinite(amount) ? amount : 0
}

const parseDailyActionAmount = (action: {
	singleUnitPrice?: string
	totalPrice?: string
}) => {
	const raw = action.singleUnitPrice ?? action.totalPrice ?? '0'
	const amount = parseFloat(String(raw).replace(/,/g, ''))

	return Number.isFinite(amount) ? amount : 0
}

const main = async () => {
	const tenantFilter = parseArg('tenant')
	const reserveRaw = parseArg('reserve')
	const reserveAmount =
		reserveRaw !== undefined ? asFiniteNumber(reserveRaw) : undefined

	await mongoose.connect(config.mongoDB.connectionString)

	const tenants = await Tenant.find(
		tenantFilter ? { tenantId: tenantFilter } : {},
	)
		.select('tenantId')
		.lean()

	let seededWarehouses = 0
	let syncedSelling = 0
	let syncedBuying = 0
	let syncedEntries = 0

	for (const tenant of tenants) {
		const tenantId = tenant.tenantId
		const cashRates = await loadCashCurrencyRates(tenantId)
		const warehouses = await Warehouse.collection
			.find({ tenantId })
			.project({ warehouseId: 1 })
			.toArray()

		for (const warehouse of warehouses) {
			const warehouseId = String(warehouse.warehouseId)

			await ensureCashAccountsForWarehouse(tenantId, warehouseId)
			seededWarehouses += 1

			if (reserveAmount !== undefined && reserveAmount > 0) {
				await postOpeningBalance({
					tenantId,
					warehouseId,
					accountType: CASH_ACCOUNT_TYPES.CASH_RESERVE,
					amount: reserveAmount,
					reason: 'Migration opening balance for Cash Reserve',
				})
			}
		}

		const invoices = await Invoice.collection.find({ tenantId }).toArray()

		for (const invoice of invoices) {
			const warehouseId = String(invoice.warehouseId ?? '')

			if (!warehouseId) continue

			const { grandTotal, paidAmount } = primaryInvoiceTotals(
				Array.isArray(invoice.currencyAmounts)
					? (invoice.currencyAmounts as Array<{
							isPrimary?: boolean
							amount?: number
							paidAmount?: number
						}>)
					: [],
				{
					amount: asFiniteNumber(invoice.amount),
					paidAmount: asFiniteNumber(invoice.paidAmount),
				},
			)

			const desired = desiredPostsForSellingInvoice({
				status: invoice.status as string | undefined,
				paymentStatus: invoice.paymentStatus as string | undefined,
				paymentType: invoice.paymentType as string | undefined,
				grandTotal,
				paidAmount,
			})

			await syncCashEffectsForReference({
				tenantId,
				warehouseId,
				referenceType: CASH_REFERENCE_TYPES.SELLING_INVOICE,
				referenceId: String(invoice.invoiceId),
				desired,
				reason: 'Historical migration',
			})

			syncedSelling += 1
		}

		const buyingInvoices = await BuyingInvoice.collection
			.find({ tenantId })
			.toArray()

		for (const invoice of buyingInvoices) {
			const warehouseId = String(invoice.warehouseId ?? '')

			if (!warehouseId) continue

			const { grandTotal, paidAmount } = primaryInvoiceTotals(
				Array.isArray(invoice.currencyAmounts)
					? (invoice.currencyAmounts as Array<{
							isPrimary?: boolean
							amount?: number
							paidAmount?: number
						}>)
					: [],
				{
					amount: asFiniteNumber(invoice.amount),
					paidAmount: asFiniteNumber(invoice.paidAmount),
				},
			)

			const desired = desiredPostsForBuyingInvoice({
				status: invoice.status as string | undefined,
				paymentStatus: invoice.paymentStatus as string | undefined,
				paymentType: invoice.paymentType as string | undefined,
				grandTotal,
				paidAmount,
			})

			await syncCashEffectsForReference({
				tenantId,
				warehouseId,
				referenceType: CASH_REFERENCE_TYPES.BUYING_INVOICE,
				referenceId: String(invoice.buyingInvoiceId),
				desired,
				reason: 'Historical migration',
			})

			syncedBuying += 1
		}

		const dailyActions = await DailyAction.collection
			.find({ tenantId })
			.toArray()

		for (const action of dailyActions) {
			const warehouseId = String(action.warehouseId ?? '')

			if (!warehouseId) continue

			const desired = desiredPostsForDailyAction({
				entryType: action.entryType,
				amount: toPrimaryCashAmount(
					parseDailyActionAmount({
						singleUnitPrice:
							typeof action.singleUnitPrice === 'string'
								? action.singleUnitPrice
								: undefined,
						totalPrice:
							typeof action.totalPrice === 'string'
								? action.totalPrice
								: undefined,
					}),
					typeof action.currencyId === 'string' ? action.currencyId : undefined,
					cashRates,
				),
				accountType:
					typeof action.cashAccountType === 'string'
						? action.cashAccountType
						: undefined,
			})

			await syncCashEffectsForReference({
				tenantId,
				warehouseId,
				referenceType: CASH_REFERENCE_TYPES.DAILY_ACTION,
				referenceId: String(action.actionId),
				desired,
				reason: 'Historical migration',
			})

			syncedEntries += 1
		}
	}

	console.log(
		JSON.stringify(
			{
				tenants: tenants.length,
				seededWarehouses,
				syncedSelling,
				syncedBuying,
				syncedEntries,
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
