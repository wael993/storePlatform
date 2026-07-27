import type { DailyActionFiltersQueryParams } from '../api/apiStore'

const getInvoiceDateBoundary = (
	dateValue: string | undefined,
	boundary: 'start' | 'end',
): Date | undefined => {
	const trimmedDateValue = dateValue?.trim()
	if (!trimmedDateValue) return undefined

	const isDateOnlyValue = /^\d{4}-\d{2}-\d{2}$/.test(trimmedDateValue)
	const date = isDateOnlyValue
		? new Date(
				`${trimmedDateValue}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`,
			)
		: new Date(trimmedDateValue)

	return Number.isNaN(date.getTime()) ? undefined : date
}

const matchesFilterValues = (
	values: string[],
	actionValue?: string,
	actionLabel?: string,
) =>
	values.some(
		value =>
			value === actionValue ||
			value === actionLabel ||
			(actionValue && actionValue.toLowerCase() === value.toLowerCase()) ||
			(actionLabel && actionLabel.toLowerCase() === value.toLowerCase()),
	)

const getEntryTypeValue = (entryType: DailyAction['entryType']) => {
	if (!entryType) return undefined
	if (typeof entryType === 'string') return entryType
	return entryType.value
}

export const parseDailyActionFiltersFromParams = (
	params: URLSearchParams,
): DailyActionFiltersQueryParams => {
	const splitParam = (key: string) => {
		const value = params.get(key)
		if (!value) return undefined
		const items = value
			.split(',')
			.map(item => item.trim())
			.filter(Boolean)
		return items.length ? items : undefined
	}

	return {
		searchText: params.get('searchText')?.trim() || undefined,
		entryType: splitParam('entryType'),
		productName: splitParam('productName'),
		supplier: splitParam('supplier'),
		customer: splitParam('customer'),
		invoiceDateFrom: params.get('invoiceDateFrom')?.trim() || undefined,
		invoiceDateTo: params.get('invoiceDateTo')?.trim() || undefined,
	}
}

export const filterDailyActionsByParams = (
	dailyActions: DailyAction[],
	filters: DailyActionFiltersQueryParams = {},
): DailyAction[] => {
	const normalizedFilters: DailyActionFiltersQueryParams = {
		entryType: filters.entryType,
		productName: filters.productName,
		supplier: filters.supplier,
		customer: filters.customer,
		searchText: filters.searchText?.trim() || undefined,
		invoiceDateFrom: filters.invoiceDateFrom?.trim() || undefined,
		invoiceDateTo: filters.invoiceDateTo?.trim() || undefined,
	}

	let filtered = [...dailyActions]

	const searchText = normalizedFilters.searchText
	if (searchText) {
		const searchRegex = new RegExp(
			searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
			'i',
		)
		filtered = filtered.filter(action =>
			searchRegex.test(String(action.invoiceNumber ?? '')),
		)
	}

	if (normalizedFilters.entryType?.length) {
		filtered = filtered.filter(action => {
			const value = getEntryTypeValue(action.entryType)
			return value ? normalizedFilters.entryType?.includes(value) : false
		})
	}

	if (normalizedFilters.productName?.length) {
		filtered = filtered.filter(action =>
			matchesFilterValues(
				normalizedFilters.productName ?? [],
				action.productId,
				action.productName,
			),
		)
	}

	if (normalizedFilters.supplier?.length) {
		filtered = filtered.filter(action =>
			matchesFilterValues(
				normalizedFilters.supplier ?? [],
				action.supplierId,
				action.supplierName,
			),
		)
	}

	if (normalizedFilters.customer?.length) {
		filtered = filtered.filter(action =>
			matchesFilterValues(
				normalizedFilters.customer ?? [],
				action.customerId,
				action.customerName,
			),
		)
	}

	const invoiceDateFrom = getInvoiceDateBoundary(
		normalizedFilters.invoiceDateFrom,
		'start',
	)
	const invoiceDateTo = getInvoiceDateBoundary(
		normalizedFilters.invoiceDateTo,
		'end',
	)
	if (invoiceDateFrom || invoiceDateTo) {
		filtered = filtered.filter(action => {
			if (!action.invoiceDate) return false
			const invoiceDate = new Date(action.invoiceDate)
			if (Number.isNaN(invoiceDate.getTime())) return false
			if (invoiceDateFrom && invoiceDate < invoiceDateFrom) return false
			if (invoiceDateTo && invoiceDate > invoiceDateTo) return false
			return true
		})
	}

	return filtered.sort((left, right) => {
		const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0
		const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0
		return rightTime - leftTime
	})
}
