import {
	amountToPrimaryWithSnapshot,
	openingBalancePrimary,
	type CostCurrencyRate,
	type OpeningBalanceLine,
} from 'store-domain'

import {
	getPrimaryInvoiceCurrencyAmounts,
	type InvoiceAmountSource,
} from '../components/SellingInvoice/currencyDisplay'
import { DailyActionType, InvoiceStatus } from '../shared/globalEnums'

const EXCLUDED_INVOICE_STATUSES = new Set<string>([
	InvoiceStatus.DRAFT,
	InvoiceStatus.CANCELLED,
	InvoiceStatus.VOID,
])

export type PartySummaryInvoice = InvoiceAmountSource & {
	status?: string
}

export type PartyInvoiceSummary = {
	totalInvoiced: number
	totalPaid: number
	outstanding: number
}

const entryTypeValue = (entryType: DailyAction['entryType']) =>
	typeof entryType === 'string' ? entryType : entryType.value

const samePartyId = (
	value: string | undefined,
	partyId: string,
	internalCode?: string,
) => value === partyId || (!!internalCode && value === internalCode)

const parseEntryAmount = (
	action: Pick<
		DailyAction,
		'totalPrice' | 'singleUnitPrice' | 'currencyId' | 'exchangeRateToPrimary'
	>,
	rates: readonly CostCurrencyRate[],
) => {
	const rawAmount = action.totalPrice || action.singleUnitPrice || '0'
	const amount = parseFloat(String(rawAmount).replace(/,/g, '')) || 0

	return amountToPrimaryWithSnapshot(
		amount,
		action.currencyId || null,
		action.exchangeRateToPrimary,
		rates,
	)
}

const sumEntryAmounts = (
	actions: DailyAction[],
	entryType: DailyActionType,
	rates: readonly CostCurrencyRate[],
) =>
	actions.reduce((sum, action) => {
		if (entryTypeValue(action.entryType) !== entryType) return sum

		return sum + parseEntryAmount(action, rates)
	}, 0)

const invoiceTotals = (invoices: PartySummaryInvoice[]) => {
	let totalInvoiced = 0
	let totalPaid = 0

	for (const invoice of invoices) {
		const status = String(invoice.status ?? InvoiceStatus.CONFIRMED)
		if (EXCLUDED_INVOICE_STATUSES.has(status)) continue

		const { grandTotal, paidAmount } = getPrimaryInvoiceCurrencyAmounts(invoice)
		totalInvoiced += grandTotal
		totalPaid += paidAmount
	}

	return { totalInvoiced, totalPaid }
}

/** Same directions as the API customer summary. */
export const customerInvoiceBalance = (
	invoices: PartySummaryInvoice[],
	entries: DailyAction[],
	rates: readonly CostCurrencyRate[] = [],
) => {
	const base = invoiceTotals(invoices)
	const totalInvoiced =
		base.totalInvoiced +
		sumEntryAmounts(entries, DailyActionType.SELLING_ENTRY, rates) +
		sumEntryAmounts(entries, DailyActionType.PAYMENT_ENTRY, rates)
	const totalPaid =
		base.totalPaid +
		sumEntryAmounts(entries, DailyActionType.RECEIPT_ENTRY, rates)

	return {
		totalInvoiced,
		totalPaid,
		totalReceivable: totalInvoiced - totalPaid,
	}
}

/** Receipt adds and payment subtracts, matching the supplier activity row. */
export const supplierInvoiceBalance = (
	invoices: PartySummaryInvoice[],
	entries: DailyAction[],
	rates: readonly CostCurrencyRate[] = [],
) => {
	const base = invoiceTotals(invoices)
	const totalInvoiced =
		base.totalInvoiced +
		sumEntryAmounts(entries, DailyActionType.BUYING_ENTRY, rates) +
		sumEntryAmounts(entries, DailyActionType.RECEIPT_ENTRY, rates)
	const totalPaid =
		base.totalPaid +
		sumEntryAmounts(entries, DailyActionType.PAYMENT_ENTRY, rates)

	return {
		totalInvoiced,
		totalPaid,
		totalPayable: totalInvoiced - totalPaid,
	}
}

export const customerPartySummary = (
	ownInvoices: PartySummaryInvoice[],
	entries: DailyAction[],
	otherInvoices: PartySummaryInvoice[],
	rates: readonly CostCurrencyRate[] = [],
	openingBalances?: readonly Pick<
		OpeningBalanceLine,
		'currencyId' | 'amount' | 'direction'
	>[],
): PartyInvoiceSummary => {
	const own = customerInvoiceBalance(ownInvoices, entries, rates)
	const other = customerInvoiceBalance(otherInvoices, [], rates)

	return {
		totalInvoiced: own.totalInvoiced,
		totalPaid: own.totalPaid,
		outstanding:
			own.totalReceivable -
			(other.totalInvoiced - other.totalPaid) +
			openingBalancePrimary('customer', openingBalances, rates),
	}
}

export const supplierPartySummary = (
	ownInvoices: PartySummaryInvoice[],
	entries: DailyAction[],
	otherInvoices: PartySummaryInvoice[],
	rates: readonly CostCurrencyRate[] = [],
	openingBalances?: readonly Pick<
		OpeningBalanceLine,
		'currencyId' | 'amount' | 'direction'
	>[],
): PartyInvoiceSummary => {
	const own = supplierInvoiceBalance(ownInvoices, entries, rates)
	const other = supplierInvoiceBalance(otherInvoices, [], rates)

	return {
		totalInvoiced: own.totalInvoiced,
		totalPaid: own.totalPaid,
		outstanding:
			own.totalPayable -
			(other.totalInvoiced - other.totalPaid) +
			openingBalancePrimary('supplier', openingBalances, rates),
	}
}

/** Selling rows, plus a payment stored on supplierId. Buying rows stay out. */
export const customerRelatedEntries = (
	actions: DailyAction[],
	party: { customerId: string; internalCode?: string },
) =>
	actions.filter(action => {
		const entryType = entryTypeValue(action.entryType)

		return (
			entryType !== DailyActionType.BUYING_ENTRY &&
			(samePartyId(action.customerId, party.customerId, party.internalCode) ||
				(entryType === DailyActionType.PAYMENT_ENTRY &&
					samePartyId(action.supplierId, party.customerId, party.internalCode)))
		)
	})

/** Buying rows on supplierId, plus a receipt stored on customerId. */
export const supplierRelatedEntries = (
	actions: DailyAction[],
	party: { supplierId: string; internalCode?: string },
) =>
	actions.filter(action => {
		const entryType = entryTypeValue(action.entryType)

		return (
			samePartyId(action.supplierId, party.supplierId, party.internalCode) ||
			(entryType === DailyActionType.RECEIPT_ENTRY &&
				samePartyId(action.customerId, party.supplierId, party.internalCode))
		)
	})
