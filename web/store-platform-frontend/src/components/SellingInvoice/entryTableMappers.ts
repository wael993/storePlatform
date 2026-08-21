import dayjs from 'dayjs'

import { DailyActionType } from '../../shared/globalEnums'
import { parseNumberValue } from '../../shared/utils'

import type { SellingInvoice } from './types'

export type QuickEntryType =
	| DailyActionType.RECEIPT_ENTRY
	| DailyActionType.PAYMENT_ENTRY
	| DailyActionType.EXPENSE_ENTRY

export type EntrySubType = 'receipt' | 'payment' | 'expense'

export interface QuickEntryFormState {
	entryType: QuickEntryType
	entityId: string
	entityName: string
	amount: string
	currencyId: string
	currencyName: string
	invoiceDate: string
	note: string
}

export interface EntryTableRow {
	kind: 'entry'
	entrySubType: EntrySubType
	id: string
	sortKey: number
	time: string
	entityName: string
	amount: number
	currencyId: string
	currencyName: string
	note?: string
}

export type InvoiceTableRow =
	(SellingInvoice & { kind: 'selling' | 'buying' }) | EntryTableRow

const ENTRY_TYPE_MAP: Record<string, EntrySubType | undefined> = {
	[DailyActionType.RECEIPT_ENTRY]: 'receipt',
	[DailyActionType.PAYMENT_ENTRY]: 'payment',
	[DailyActionType.EXPENSE_ENTRY]: 'expense',
}

const QUICK_ENTRY_TYPES = new Set<string>([
	DailyActionType.RECEIPT_ENTRY,
	DailyActionType.PAYMENT_ENTRY,
	DailyActionType.EXPENSE_ENTRY,
])

const getTodayDateInputValue = () => {
	const today = new Date()
	const month = String(today.getMonth() + 1).padStart(2, '0')
	const day = String(today.getDate()).padStart(2, '0')
	return `${today.getFullYear()}-${month}-${day}`
}

export const getDailyActionEntryTypeValue = (
	entryType: DailyAction['entryType'],
) => {
	if (!entryType) return undefined
	if (typeof entryType === 'string') return entryType
	return entryType.value
}

const parseEntryAmount = (dailyAction: DailyAction) => {
	const rawAmount = dailyAction.singleUnitPrice ?? dailyAction.totalPrice ?? '0'
	const amount = parseFloat(String(rawAmount).replace(/,/g, ''))
	return Number.isFinite(amount) ? amount : 0
}

const formatEntryTime = (dailyAction: DailyAction) => {
	const source = dailyAction.createdAt ?? dailyAction.invoiceDate
	if (!source) return '--:--'
	return dayjs(source).format('hh:mm A')
}

export const mapDailyActionToEntryTableRow = (
	dailyAction: DailyAction,
): EntryTableRow | null => {
	const entryTypeValue = getDailyActionEntryTypeValue(dailyAction.entryType)
	if (
		!entryTypeValue ||
		!QUICK_ENTRY_TYPES.has(entryTypeValue as DailyActionType)
	) {
		return null
	}

	const entrySubType = ENTRY_TYPE_MAP[entryTypeValue]
	if (!entrySubType) return null

	const id = dailyAction.actionId ?? dailyAction._id
	if (!id) return null

	const entityName =
		dailyAction.customerName ??
		dailyAction.supplierName ??
		dailyAction.expenseName ??
		dailyAction.partnerName ??
		'-'

	const sortSource = dailyAction.createdAt ?? dailyAction.invoiceDate

	return {
		kind: 'entry',
		entrySubType,
		id,
		sortKey: sortSource ? dayjs(sortSource).valueOf() : 0,
		time: formatEntryTime(dailyAction),
		entityName,
		amount: parseEntryAmount(dailyAction),
		currencyId: dailyAction.currencyId ?? '',
		currencyName: dailyAction.currencyName ?? '',
		note: dailyAction.note,
	}
}

export const mapDailyActionToQuickEntryForm = (
	dailyAction: DailyAction,
): QuickEntryFormState | null => {
	const entryTypeValue = getDailyActionEntryTypeValue(dailyAction.entryType)
	if (!entryTypeValue || !QUICK_ENTRY_TYPES.has(entryTypeValue)) {
		return null
	}

	const entryType = entryTypeValue as QuickEntryType
	let entityId = ''
	let entityName = ''

	switch (entryType) {
		case DailyActionType.RECEIPT_ENTRY:
			entityId = dailyAction.partnerId ?? dailyAction.customerId ?? ''
			entityName = dailyAction.partnerName ?? dailyAction.customerName ?? ''
			break
		case DailyActionType.PAYMENT_ENTRY:
			entityId = dailyAction.partnerId ?? dailyAction.supplierId ?? ''
			entityName = dailyAction.partnerName ?? dailyAction.supplierName ?? ''
			break
		case DailyActionType.EXPENSE_ENTRY:
			entityId = dailyAction.expenseId ?? ''
			entityName = dailyAction.expenseName ?? ''
			break
	}

	const rawAmount = dailyAction.singleUnitPrice ?? dailyAction.totalPrice ?? ''
	const invoiceDate =
		dailyAction.invoiceDate?.split('T')[0] ?? getTodayDateInputValue()

	return {
		entryType,
		entityId,
		entityName,
		amount: rawAmount ? parseNumberValue(String(rawAmount), 2) : '',
		currencyId: dailyAction.currencyId ?? '',
		currencyName: dailyAction.currencyName ?? '',
		invoiceDate,
		note: dailyAction.note ?? '',
	}
}

export const getDailyActionId = (dailyAction: DailyAction) =>
	dailyAction.actionId ?? dailyAction._id ?? ''

export const mapDailyActionsToEntryTableRows = (
	dailyActions: DailyAction[],
): EntryTableRow[] =>
	dailyActions
		.map(mapDailyActionToEntryTableRow)
		.filter((row): row is EntryTableRow => row !== null)
