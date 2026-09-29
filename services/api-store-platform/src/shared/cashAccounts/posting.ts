import type { ClientSession } from 'mongoose'

import CurrencySettings from '../../models/CurrencySettings'
import type { RequestContext } from '../types'
import { getTenantContext } from '../tenant'
import {
	amountToPrimary,
	ratesFromCurrencySettings,
	type CostCurrencyRate,
} from '../inventoryCost'
import {
	desiredPostsForBuyingInvoice,
	desiredPostsForDailyAction,
	desiredPostsForSellingInvoice,
} from './cashImpact'
import { syncCashEffectsForReference } from './ledgerService'
import { CASH_REFERENCE_TYPES } from './types'

const asFiniteNumber = (value: unknown) => {
	const amount = typeof value === 'number' ? value : Number(value)

	return Number.isFinite(amount) ? amount : 0
}

/** Cash ledger is primary-only; convert display amounts with tenant FX rates. */
export const loadCashCurrencyRates = async (
	tenantId: string,
): Promise<CostCurrencyRate[]> => {
	const settings = await CurrencySettings.findOne({ tenantId })
		.select('primaryCurrency secondaryCurrencies')
		.lean()

	return ratesFromCurrencySettings(settings)
}

export const toPrimaryCashAmount = (
	amount: number,
	currencyId: string | null | undefined,
	rates: readonly CostCurrencyRate[],
) => amountToPrimary(amount, currencyId ?? null, rates)

export const primaryInvoiceTotals = (
	currencyAmounts: Array<{
		isPrimary?: boolean
		amount?: number
		paidAmount?: number
	}> = [],
	fallback?: { amount?: number; paidAmount?: number },
) => {
	const primary =
		currencyAmounts.find(amount => amount.isPrimary) ?? currencyAmounts[0]

	if (primary) {
		return {
			grandTotal: asFiniteNumber(primary.amount),
			paidAmount: asFiniteNumber(primary.paidAmount),
		}
	}

	return {
		grandTotal: asFiniteNumber(fallback?.amount),
		paidAmount: asFiniteNumber(fallback?.paidAmount),
	}
}

export const syncSellingInvoiceCashLedger = async (params: {
	requestContext: RequestContext
	warehouseId: string
	invoiceId: string
	status?: string
	paymentStatus?: string
	paymentType?: string
	currencyAmounts?: Array<{
		isPrimary?: boolean
		amount?: number
		paidAmount?: number
	}>
	amount?: number
	paidAmount?: number
	session?: ClientSession
}) => {
	const { grandTotal, paidAmount } = primaryInvoiceTotals(
		params.currencyAmounts,
		{ amount: params.amount, paidAmount: params.paidAmount },
	)
	const desired = desiredPostsForSellingInvoice({
		status: params.status,
		paymentStatus: params.paymentStatus,
		paymentType: params.paymentType,
		grandTotal,
		paidAmount,
	})

	await syncCashEffectsForReference({
		requestContext: params.requestContext,
		tenantId: getTenantContext(params.requestContext).tenantId,
		warehouseId: params.warehouseId,
		referenceType: CASH_REFERENCE_TYPES.SELLING_INVOICE,
		referenceId: params.invoiceId,
		desired,
		session: params.session,
	})
}

export const syncBuyingInvoiceCashLedger = async (params: {
	requestContext: RequestContext
	warehouseId: string
	buyingInvoiceId: string
	status?: string
	paymentStatus?: string
	paymentType?: string
	currencyAmounts?: Array<{
		isPrimary?: boolean
		amount?: number
		paidAmount?: number
	}>
	amount?: number
	paidAmount?: number
	session?: ClientSession
}) => {
	const { grandTotal, paidAmount } = primaryInvoiceTotals(
		params.currencyAmounts,
		{ amount: params.amount, paidAmount: params.paidAmount },
	)
	const desired = desiredPostsForBuyingInvoice({
		status: params.status,
		paymentStatus: params.paymentStatus,
		paymentType: params.paymentType,
		grandTotal,
		paidAmount,
	})

	await syncCashEffectsForReference({
		requestContext: params.requestContext,
		tenantId: getTenantContext(params.requestContext).tenantId,
		warehouseId: params.warehouseId,
		referenceType: CASH_REFERENCE_TYPES.BUYING_INVOICE,
		referenceId: params.buyingInvoiceId,
		desired,
		session: params.session,
	})
}

export const syncDailyActionCashLedger = async (params: {
	requestContext: RequestContext
	warehouseId: string
	actionId: string
	entryType?: unknown
	/** Amount in the entry's currency (converted to primary before posting). */
	amount: number
	currencyId?: string | null
	accountType?: string | null
	session?: ClientSession
	clear?: boolean
}) => {
	const tenantId = getTenantContext(params.requestContext).tenantId
	const rates = params.clear ? [] : await loadCashCurrencyRates(tenantId)
	const primaryAmount = params.clear
		? 0
		: toPrimaryCashAmount(params.amount, params.currencyId, rates)

	const desired = params.clear
		? []
		: desiredPostsForDailyAction({
				entryType: params.entryType,
				amount: primaryAmount,
				accountType: params.accountType,
			})

	await syncCashEffectsForReference({
		requestContext: params.requestContext,
		tenantId,
		warehouseId: params.warehouseId,
		referenceType: CASH_REFERENCE_TYPES.DAILY_ACTION,
		referenceId: params.actionId,
		desired,
		session: params.session,
	})
}

export const clearCashLedgerForReference = async (params: {
	requestContext: RequestContext
	warehouseId: string
	referenceType: string
	referenceId: string
	session?: ClientSession
}) => {
	await syncCashEffectsForReference({
		requestContext: params.requestContext,
		tenantId: getTenantContext(params.requestContext).tenantId,
		warehouseId: params.warehouseId,
		referenceType: params.referenceType,
		referenceId: params.referenceId,
		desired: [],
		session: params.session,
	})
}
