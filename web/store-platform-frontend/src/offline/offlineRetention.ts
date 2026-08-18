import { offlineDb } from './db'
import { InvoicePaymentStatus, InvoicePaymentType } from '../shared/globalEnums'
import type {
	LocalBuyingInvoice,
	LocalDailyAction,
	LocalInvoice,
} from './types'

export const OFFLINE_SYNC_RETENTION_DAYS = 90

export const getRetentionCutoffDate = (
	retentionDays: number = OFFLINE_SYNC_RETENTION_DAYS,
): Date => {
	const cutoff = new Date()
	cutoff.setDate(cutoff.getDate() - retentionDays)
	cutoff.setHours(0, 0, 0, 0)
	return cutoff
}

export const getRetentionCutoffIso = (
	retentionDays: number = OFFLINE_SYNC_RETENTION_DAYS,
): string => getRetentionCutoffDate(retentionDays).toISOString()

export const isOpenCreditInvoice = (invoice: LocalInvoice): boolean =>
	invoice.paymentType === InvoicePaymentType.CREDIT &&
	invoice.paymentStatus !== InvoicePaymentStatus.PAID

export const shouldRetainInvoice = (
	invoice: LocalInvoice,
	cutoff: Date,
): boolean => {
	if (invoice.syncStatus === 'pending') return true
	if (isOpenCreditInvoice(invoice)) return true

	const issuedAt = invoice.issuedAt ? new Date(invoice.issuedAt) : null
	return (
		issuedAt !== null && !Number.isNaN(issuedAt.getTime()) && issuedAt >= cutoff
	)
}

export const isOpenCreditBuyingInvoice = (
	invoice: LocalBuyingInvoice,
): boolean =>
	invoice.paymentType === InvoicePaymentType.CREDIT &&
	invoice.paymentStatus !== InvoicePaymentStatus.PAID

export const shouldRetainBuyingInvoice = (
	invoice: LocalBuyingInvoice,
	cutoff: Date,
): boolean => {
	if (invoice.syncStatus === 'pending') return true
	if (isOpenCreditBuyingInvoice(invoice)) return true

	const issuedAt = invoice.issuedAt ? new Date(invoice.issuedAt) : null
	return (
		issuedAt !== null && !Number.isNaN(issuedAt.getTime()) && issuedAt >= cutoff
	)
}
export const shouldRetainDailyAction = (
	action: LocalDailyAction,
	cutoff: Date,
): boolean => {
	if (action.syncStatus === 'pending') return true

	const invoiceDate = action.invoiceDate ? new Date(action.invoiceDate) : null
	return (
		invoiceDate !== null &&
		!Number.isNaN(invoiceDate.getTime()) &&
		invoiceDate >= cutoff
	)
}

const mergeByKey = <T>(items: T[], getKey: (item: T) => string): T[] => {
	const map = new Map<string, T>()
	for (const item of items) {
		map.set(getKey(item), item)
	}
	return [...map.values()]
}

export const getLocalInvoicesForOffline = async (): Promise<LocalInvoice[]> => {
	const cutoffIso = getRetentionCutoffIso()
	const [recent, pending, openCredit] = await Promise.all([
		offlineDb.invoices.where('issuedAt').aboveOrEqual(cutoffIso).toArray(),
		offlineDb.invoices.where('syncStatus').equals('pending').toArray(),
		offlineDb.invoices
			.filter(invoice => isOpenCreditInvoice(invoice))
			.toArray(),
	])

	return mergeByKey(
		[...recent, ...pending, ...openCredit],
		invoice => invoice.invoiceId,
	)
}

export const getLocalBuyingInvoicesForOffline = async (): Promise<
	LocalBuyingInvoice[]
> => {
	const cutoffIso = getRetentionCutoffIso()
	const [recent, pending, openCredit] = await Promise.all([
		offlineDb.buyingInvoices
			.where('issuedAt')
			.aboveOrEqual(cutoffIso)
			.toArray(),
		offlineDb.buyingInvoices.where('syncStatus').equals('pending').toArray(),
		offlineDb.buyingInvoices
			.filter(invoice => isOpenCreditBuyingInvoice(invoice))
			.toArray(),
	])

	return mergeByKey(
		[...recent, ...pending, ...openCredit],
		invoice => invoice.buyingInvoiceId,
	)
}

export const getLocalDailyActionsForOffline = async (): Promise<
	LocalDailyAction[]
> => {
	const cutoffIso = getRetentionCutoffIso()
	const [recent, pending] = await Promise.all([
		offlineDb.dailyActions
			.where('invoiceDate')
			.aboveOrEqual(cutoffIso)
			.toArray(),
		offlineDb.dailyActions.where('syncStatus').equals('pending').toArray(),
	])

	return mergeByKey([...recent, ...pending], action => action.actionId)
}

export const pruneExpiredOfflineRecords = async (
	retentionDays: number = OFFLINE_SYNC_RETENTION_DAYS,
): Promise<void> => {
	const cutoff = getRetentionCutoffDate(retentionDays)

	const [invoices, buyingInvoices, dailyActions] = await Promise.all([
		offlineDb.invoices.toArray(),
		offlineDb.buyingInvoices.toArray(),
		offlineDb.dailyActions.toArray(),
	])

	const invoiceIdsToDelete = invoices
		.filter(invoice => !shouldRetainInvoice(invoice, cutoff))
		.map(invoice => invoice.invoiceId)

	const buyingInvoiceIdsToDelete = buyingInvoices
		.filter(invoice => !shouldRetainBuyingInvoice(invoice, cutoff))
		.map(invoice => invoice.buyingInvoiceId)

	const actionIdsToDelete = dailyActions
		.filter(action => !shouldRetainDailyAction(action, cutoff))
		.map(action => action.actionId)

	await Promise.all([
		invoiceIdsToDelete.length
			? offlineDb.invoices.bulkDelete(invoiceIdsToDelete)
			: Promise.resolve(),
		buyingInvoiceIdsToDelete.length
			? offlineDb.buyingInvoices.bulkDelete(buyingInvoiceIdsToDelete)
			: Promise.resolve(),
		actionIdsToDelete.length
			? offlineDb.dailyActions.bulkDelete(actionIdsToDelete)
			: Promise.resolve(),
	])
}
