import { config } from '../config'
import { Breakpoints, EntryType, TargetType } from './globalEnums'

export function compareBreakpoint(breakpoint: Breakpoints | undefined) {
	return {
		isMobile: breakpoint === Breakpoints.MOBILE || !breakpoint,
		isTablet: breakpoint === Breakpoints.TABLET || !breakpoint,
		isDesktop: breakpoint === Breakpoints.DESKTOP || !breakpoint,
		isLargeDesktop: breakpoint === Breakpoints.LARGE_DESKTOP || !breakpoint,
	}
}

export function compareTargetType(entryType: TargetType) {
	return {
		isCustomerTarget: entryType === TargetType.CUSTOMER,
		isSupplierTarget: entryType === TargetType.SUPPLIER,
		isProductTarget: entryType === TargetType.PRODUCT,
		isDailyActionTarget: entryType === TargetType.DAILY_ACTION,
	}
}

export function compareEntryType(entryType: EntryType) {
	return {
		isSellingEntry: entryType === EntryType.SELLING_ENTRY,
		isBuyingEntry: entryType === EntryType.BUYING_ENTRY,
		isReceiptEntry: entryType === EntryType.RECEIPT_ENTRY,
		isPaymentEntry: entryType === EntryType.PAYMENT_ENTRY,
		isExpenseEntry: entryType === EntryType.EXPENSE_ENTRY,
	}
}

export function compareLanguage(language?: string) {
	return {
		isArabic: language?.toLowerCase().startsWith('ar') ?? false,
		isEnglish: language?.toLowerCase().startsWith('en') ?? false,
		isGerman: language?.toLowerCase().startsWith('de') ?? false,
	}
}

export const getEnabledActions = () => {
	const enabledActions = new Set(config.actionsEnabled)

	return {
		isAddNewTenantEnabled: enabledActions.has('ADD_NEW_TENANT'),
		isTenantsListEnabled: enabledActions.has('TENANTS_LIST'),
		isDailyEnabled: enabledActions.has('DAILY'),
		isBarcodeEnabled: enabledActions.has('BARCODE'),
		isProductsEnabled: enabledActions.has('PRODUCTS'),
		isOrdersEnabled: enabledActions.has('ORDERS'),
		isInvoicesEnabled: enabledActions.has('INVOICE'),
		isCustomersEnabled: enabledActions.has('CUSTOMERS'),
		isSuppliersEnabled: enabledActions.has('SUPPLIERS'),
		isUsersEnabled: enabledActions.has('USERS'),
		isSettingsEnabled: enabledActions.has('SETTINGS'),
		isChangePasswordEnabled: enabledActions.has('CHANGE_PASSWORD'),
	}
}

export const getTenantActions = () => {
	const enabledTenantActions = new Set(config.tenantActions)

	return {
		isTenantAddNewTenantEnabled: enabledTenantActions.has('ADD_NEW_TENANT'),
		isTenantTenantsListEnabled: enabledTenantActions.has('TENANTS_LIST'),
		isTenantBarcodeEnabled: enabledTenantActions.has('BARCODE'),
		isTenantProductsEnabled: enabledTenantActions.has('PRODUCTS'),
		isTenantDailyEnabled: enabledTenantActions.has('DAILY'),
		isTenantOrdersEnabled: enabledTenantActions.has('ORDERS'),
		isTenantInvoicesEnabled: enabledTenantActions.has('INVOICE'),
		isTenantUsersEnabled: enabledTenantActions.has('USERS'),
		isTenantSettingsEnabled: enabledTenantActions.has('SETTINGS'),
		isTenantCustomersEnabled: enabledTenantActions.has('CUSTOMERS'),
		isTenantSuppliersEnabled: enabledTenantActions.has('SUPPLIERS'),
		isTenantChangePasswordEnabled: enabledTenantActions.has('CHANGE_PASSWORD'),
	}
}

export const mapFee = (fee?: string): string | undefined => {
	const normalizedFee = fee?.replaceAll(',', '')
	if (!normalizedFee || isNaN(Number(normalizedFee))) return undefined

	const feeAsNumber: number = parseFloat(normalizedFee)
	const roundedFee: number = parseFloat(feeAsNumber.toFixed(2))

	const decimalPart: string =
		roundedFee % 1 !== 0 ? (roundedFee % 1).toFixed(2).substring(2) : ''

	const formattedAmount: string =
		Math.floor(roundedFee).toLocaleString('en-US') +
		(decimalPart ? `.${decimalPart}` : '')

	return formattedAmount
}

export const formatNumber = (
	value: string | number | null | undefined,
	options?: { minimumDecimals?: number; maximumDecimals?: number },
): string | undefined => {
	if (typeof value === 'string') {
		value = value.replaceAll(',', '')
	}
	if (
		value === undefined ||
		value === null ||
		value === '' ||
		isNaN(Number(value))
	) {
		return undefined
	}

	const valueAsNumber: number =
		typeof value === 'number' ? value : parseFloat(value)

	const formattedAmount: string = valueAsNumber.toLocaleString('en-US', {
		minimumFractionDigits: options?.minimumDecimals ?? 2,
		maximumFractionDigits: options?.maximumDecimals ?? 2,
	})
	return formattedAmount
}

export const withNoValueFallback = (value: string | null | undefined) =>
	value || 'N/A'

export const parseNumberValue = (
	value: string,
	maximumDecimals: number = 2,
): string => {
	value = value.replace(/[^\d.]/g, '')

	// Ensure there is only one dot
	const dotIndex = value.indexOf('.')
	if (dotIndex !== -1) {
		value =
			value.slice(0, dotIndex + 1) +
			value.slice(dotIndex + 1).replace(/\./g, '')
	}

	// Limit to 2 decimal places
	const parts = value.split('.')
	if (parts.length > 1) {
		parts[1] = parts[1].slice(0, maximumDecimals)
		value = parts.join('.')
	}

	return value
}

export const formatNumberForDb = (
	value: string | number | null | undefined,
	decimals: number = 2,
): string | undefined => {
	if (value === undefined || value === null || value === '') return undefined

	const normalizedValue =
		typeof value === 'number'
			? value.toString()
			: parseNumberValue(value, decimals)
	const numberValue = Number(normalizedValue)

	if (!Number.isFinite(numberValue)) return undefined

	return numberValue.toFixed(decimals)
}
