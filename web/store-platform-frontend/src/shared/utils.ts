import { config } from '../config'
import { Breakpoints, EntryModalType } from './globalEnums'

export function compareBreakpoint(breakpoint: Breakpoints | undefined) {
	return {
		isMobile: breakpoint === Breakpoints.MOBILE || !breakpoint,
		isTablet: breakpoint === Breakpoints.TABLET || !breakpoint,
		isDesktop: breakpoint === Breakpoints.DESKTOP || !breakpoint,
		isLargeDesktop: breakpoint === Breakpoints.LARGE_DESKTOP || !breakpoint,
	}
}

export function compareEntryType(entryType: EntryModalType) {
	return {
		isCustomerEntry: entryType === EntryModalType.CUSTOMER_ENTRY,
		isSupplierEntry: entryType === EntryModalType.SUPPLIER_ENTRY,
		isProductEntry: entryType === EntryModalType.PRODUCT_ENTRY,
		isDailyActionEntry: entryType === EntryModalType.DAILY_ACTION_ENTRY,
		isPaymentEntry: entryType === EntryModalType.PAYMENT_ENTRY,
		isReceiptEntry: entryType === EntryModalType.RECEIPT_ENTRY,
		isSaleEntry: entryType === EntryModalType.SALE_ENTRY,
		isPurchaseEntry: entryType === EntryModalType.PURCHASE_ENTRY,
		isOtherEntry: entryType === EntryModalType.OTHER_ENTRY,
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
	if (!fee || isNaN(Number(fee))) return undefined

	const feeAsNumber: number = parseFloat(fee)
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
