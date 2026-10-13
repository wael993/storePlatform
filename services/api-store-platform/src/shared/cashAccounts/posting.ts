import type { ClientSession } from 'mongoose'

import CurrencySettings from '../../models/CurrencySettings'
import { InvoicePaymentType } from '../globalEnums'
import type { RequestContext } from '../types'
import { getTenantContext } from '../tenant'
import {
	allocateCashTenders,
	type CashTender,
	type CashTenderInput,
} from '../store-domain/cashTender'
import {
	ratesFromCurrencySettings,
	type CostCurrencyRate,
} from '../inventoryCost'
import {
	desiredPostsForBuyingInvoice,
	desiredPostsForDailyAction,
	desiredPostsForSellingInvoice,
	type InvoiceCashTender,
} from './cashImpact'
import { syncCashEffectsForReference } from './ledgerService'
import { CASH_REFERENCE_TYPES, isCashAccountType } from './types'

const asFiniteNumber = (value: unknown) => {
	const amount = typeof value === 'number' ? value : Number(value)

	return Number.isFinite(amount) ? amount : 0
}

/** Party valuation and inventory cost still use these rates. Cash posting does not. */
export const loadCashCurrencyRates = async (
	tenantId: string,
): Promise<CostCurrencyRate[]> => {
	const settings = await CurrencySettings.findOne({ tenantId })
		.select('primaryCurrency secondaryCurrencies')
		.lean()

	return ratesFromCurrencySettings(settings)
}

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

type InvoiceAmountRow = {
	currencyId?: string
	isPrimary?: boolean
	exchangeRate?: number
	amount?: number
	paidAmount?: number
}

const primaryCurrencyRow = (currencyAmounts: InvoiceAmountRow[] = []) =>
	currencyAmounts.find(amount => amount.isPrimary) ?? currencyAmounts[0]

/** Snapshot rates on the invoice, not the tenant's current settings. */
export const storedInvoiceTenders = (
	tenders: readonly CashTenderInput[] | undefined,
	currencyAmounts: InvoiceAmountRow[] | undefined,
): CashTender[] => {
	const due = asFiniteNumber(primaryCurrencyRow(currencyAmounts)?.amount)
	const inputs = (tenders ?? [])
		.map(tender => ({
			currencyId: String(tender.currencyId ?? '').trim(),
			tenderedAmount: asFiniteNumber(tender.tenderedAmount),
		}))
		.filter(tender => tender.currencyId && tender.tenderedAmount > 0)

	if (inputs.length === 0) return []

	return allocateCashTenders(
		inputs,
		due,
		(currencyAmounts ?? []).map(row => ({
			currencyId: String(row.currencyId ?? ''),
			exchangeRate: asFiniteNumber(row.exchangeRate) || 1,
		})),
	)
}

/** Old invoices have no invoice currency and no tenders. Keep that on edit. */
export const isHistoricalInvoiceCash = (invoice: unknown) => {
	if (!invoice || typeof invoice !== 'object') return false

	const row = invoice as { invoiceCurrencyId?: unknown; tenders?: unknown }
	const currencyId =
		typeof row.invoiceCurrencyId === 'string'
			? row.invoiceCurrencyId.trim()
			: ''
	const tenders = Array.isArray(row.tenders) ? row.tenders : []

	return !currencyId && tenders.length === 0
}

export const prepareInvoiceCashFields = (params: {
	paymentType?: string
	invoiceCurrencyId?: string | null
	cashAccountType?: string | null
	currencyAmounts?: InvoiceAmountRow[]
	tenders?: readonly CashTenderInput[]
}) => {
	const invoiceCurrencyId = params.invoiceCurrencyId?.trim() || undefined

	if (params.paymentType === InvoicePaymentType.CREDIT) {
		return {
			invoiceCurrencyId,
			cashAccountType: undefined,
			tenders: [] as CashTender[],
		}
	}

	return {
		invoiceCurrencyId,
		cashAccountType: isCashAccountType(params.cashAccountType)
			? params.cashAccountType
			: undefined,
		tenders: storedInvoiceTenders(params.tenders, params.currencyAmounts),
	}
}

const cashPostsForInvoice = (
	kind: 'sale' | 'purchase',
	params: {
		status?: string
		paymentStatus?: string
		paymentType?: string
		cashAccountType?: string | null
		invoiceCurrencyId?: string | null
		currencyAmounts?: InvoiceAmountRow[]
		tenders?: CashTender[]
		amount?: number
		paidAmount?: number
	},
) => {
	const rows = params.currencyAmounts ?? []
	const primary = primaryCurrencyRow(rows)
	const historical =
		!params.invoiceCurrencyId?.trim() && !params.tenders?.length
	const commercial = historical
		? primary
		: (rows.find(row => row.currencyId === params.invoiceCurrencyId) ?? primary)
	const { grandTotal, paidAmount } = historical
		? primaryInvoiceTotals(rows, {
				amount: params.amount,
				paidAmount: params.paidAmount,
			})
		: {
				grandTotal: asFiniteNumber(commercial?.amount ?? params.amount),
				paidAmount: asFiniteNumber(commercial?.paidAmount ?? params.paidAmount),
			}
	const invoice = {
		status: params.status,
		paymentStatus: params.paymentStatus,
		paymentType: params.paymentType,
		cashAccountType: params.cashAccountType,
		grandTotal,
		paidAmount,
		currencyId: historical
			? primary?.currencyId
			: (commercial?.currencyId ?? params.invoiceCurrencyId),
		tenders: (params.tenders ?? []).filter(
			(tender): tender is InvoiceCashTender & CashTender =>
				tender.appliedAmount > 0,
		),
	}

	return kind === 'sale'
		? desiredPostsForSellingInvoice(invoice)
		: desiredPostsForBuyingInvoice(invoice)
}

export const syncSellingInvoiceCashLedger = async (params: {
	requestContext: RequestContext
	warehouseId: string
	invoiceId: string
	status?: string
	paymentStatus?: string
	paymentType?: string
	cashAccountType?: string | null
	invoiceCurrencyId?: string | null
	tenders?: CashTender[]
	currencyAmounts?: InvoiceAmountRow[]
	amount?: number
	paidAmount?: number
	session?: ClientSession
}) => {
	const desired = cashPostsForInvoice('sale', params)

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
	cashAccountType?: string | null
	invoiceCurrencyId?: string | null
	tenders?: CashTender[]
	currencyAmounts?: InvoiceAmountRow[]
	amount?: number
	paidAmount?: number
	session?: ClientSession
}) => {
	const desired = cashPostsForInvoice('purchase', params)

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
	/** Amount in `currencyId`. Posted as-is. */
	amount: number
	currencyId?: string | null
	accountType?: string | null
	session?: ClientSession
	clear?: boolean
}) => {
	const tenantId = getTenantContext(params.requestContext).tenantId
	const desired = params.clear
		? []
		: desiredPostsForDailyAction({
				entryType: params.entryType,
				amount: params.amount,
				currencyId: params.currencyId,
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
