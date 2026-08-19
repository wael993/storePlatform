import { config } from '../config'
import { Breakpoints, EntryType, TargetType } from './globalEnums'
import { RoutePaths } from './routes'
import {
	CONFIGURABLE_TENANT_PAGES,
	TenantAccessiblePage,
} from './tenantAccessiblePages'

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
		isPartnerTarget: entryType === TargetType.PARTNER,
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
		isSellingInvoicesEnabled: enabledActions.has('SELLING_INVOICES'),
		isCustomersEnabled: enabledActions.has('CUSTOMERS'),
		isCategoriesEnabled: enabledActions.has('CATEGORIES'),
		isSuppliersEnabled: enabledActions.has('SUPPLIERS'),
		isPartnersEnabled: enabledActions.has('PARTNERS'),
		isUsersEnabled: enabledActions.has('USERS'),
		isEmployeesEnabled: enabledActions.has('EMPLOYEES'),
		isSettingsEnabled: enabledActions.has('SETTINGS'),
		isChangePasswordEnabled: enabledActions.has('CHANGE_PASSWORD'),
	}
}

export const getGloballyEnabledTenantPages = (
	enabledActions: ReturnType<typeof getEnabledActions>,
): TenantAccessiblePage[] => {
	const pageFlags: Record<TenantAccessiblePage, boolean> = {
		USERS: enabledActions.isUsersEnabled,
		EMPLOYEES: enabledActions.isEmployeesEnabled,
		PRODUCTS: enabledActions.isProductsEnabled,
		DAILY: enabledActions.isDailyEnabled,
		SUPPLIERS: enabledActions.isSuppliersEnabled,
		CUSTOMERS: enabledActions.isCustomersEnabled,
		CATEGORIES: enabledActions.isCategoriesEnabled,
		PARTNERS: enabledActions.isPartnersEnabled,
		ORDERS: enabledActions.isOrdersEnabled,
		INVOICE: enabledActions.isInvoicesEnabled,
		SELLING_INVOICES: enabledActions.isSellingInvoicesEnabled,
		INVENTORY: enabledActions.isProductsEnabled,
		REPORTS: enabledActions.isProductsEnabled,
		BARCODE: enabledActions.isBarcodeEnabled,
		SETTINGS: enabledActions.isSettingsEnabled,
	}

	return CONFIGURABLE_TENANT_PAGES.filter(page => pageFlags[page])
}

export const getTenantActions = (accessiblePages?: string[] | null) => {
	const globallyEnabled = new Set(config.tenantActions)
	const tenantPages = accessiblePages?.length
		? new Set(accessiblePages.filter(page => globallyEnabled.has(page)))
		: globallyEnabled

	return {
		isTenantAddNewTenantEnabled: tenantPages.has('ADD_NEW_TENANT'),
		isTenantTenantsListEnabled: tenantPages.has('TENANTS_LIST'),
		isTenantBarcodeEnabled: tenantPages.has('BARCODE'),
		isTenantProductsEnabled: tenantPages.has('PRODUCTS'),
		isTenantDailyEnabled: tenantPages.has('DAILY'),
		isTenantOrdersEnabled: tenantPages.has('ORDERS'),
		isTenantInvoicesEnabled: tenantPages.has('INVOICE'),
		isTenantUsersEnabled: tenantPages.has('USERS'),
		isTenantEmployeesEnabled: tenantPages.has('EMPLOYEES'),
		isTenantSettingsEnabled: tenantPages.has('SETTINGS'),
		isTenantSellingInvoicesEnabled: tenantPages.has('SELLING_INVOICES'),
		isTenantCustomersEnabled: tenantPages.has('CUSTOMERS'),
		isTenantCategoriesEnabled: tenantPages.has('CATEGORIES'),
		isTenantSuppliersEnabled: tenantPages.has('SUPPLIERS'),
		isTenantPartnersEnabled: tenantPages.has('PARTNERS'),
		isTenantChangePasswordEnabled: tenantPages.has('CHANGE_PASSWORD'),
	}
}

type TenantActionFlags = ReturnType<typeof getTenantActions>
type GlobalActionFlags = ReturnType<typeof getEnabledActions>

export const isTenantRouteAllowed = (
	pathname: string,
	globalActions: GlobalActionFlags,
	tenantActions: TenantActionFlags,
): boolean => {
	if (
		pathname === RoutePaths.ROOT ||
		pathname === RoutePaths.STORE_PLATFORM ||
		pathname.startsWith(RoutePaths.LOGIN)
	) {
		return true
	}

	const routeChecks: Array<[string, boolean]> = [
		[
			RoutePaths.BARCODE,
			globalActions.isBarcodeEnabled && tenantActions.isTenantBarcodeEnabled,
		],
		[
			RoutePaths.PRODUCTS,
			globalActions.isProductsEnabled && tenantActions.isTenantProductsEnabled,
		],
		[
			RoutePaths.DAILY,
			globalActions.isDailyEnabled && tenantActions.isTenantDailyEnabled,
		],
		[
			RoutePaths.ORDERS,
			globalActions.isOrdersEnabled && tenantActions.isTenantOrdersEnabled,
		],
		[
			RoutePaths.INVOICES,
			globalActions.isInvoicesEnabled && tenantActions.isTenantInvoicesEnabled,
		],
		[
			RoutePaths.SELLING_INVOICES,
			globalActions.isSellingInvoicesEnabled &&
				tenantActions.isTenantSellingInvoicesEnabled,
		],
		[
			RoutePaths.CUSTOMERS,
			globalActions.isCustomersEnabled &&
				tenantActions.isTenantCustomersEnabled,
		],
		[
			RoutePaths.CATEGORIES,
			globalActions.isCategoriesEnabled &&
				tenantActions.isTenantCategoriesEnabled,
		],
		[
			RoutePaths.SUPPLIERS,
			globalActions.isSuppliersEnabled &&
				tenantActions.isTenantSuppliersEnabled,
		],
		[
			RoutePaths.PARTNERS,
			globalActions.isPartnersEnabled && tenantActions.isTenantPartnersEnabled,
		],
		[
			RoutePaths.USERS,
			globalActions.isUsersEnabled && tenantActions.isTenantUsersEnabled,
		],
		[
			RoutePaths.EMPLOYEES,
			globalActions.isEmployeesEnabled &&
				tenantActions.isTenantEmployeesEnabled,
		],
		[
			RoutePaths.SETTINGS,
			globalActions.isSettingsEnabled && tenantActions.isTenantSettingsEnabled,
		],
		[
			RoutePaths.ADD_NEW_TENANT,
			globalActions.isAddNewTenantEnabled &&
				tenantActions.isTenantAddNewTenantEnabled,
		],
		[
			RoutePaths.TENANTS_LIST,
			globalActions.isTenantsListEnabled &&
				tenantActions.isTenantTenantsListEnabled,
		],
	]

	for (const [routePath, isAllowed] of routeChecks) {
		if (pathname === routePath || pathname.startsWith(`${routePath}/`)) {
			return isAllowed
		}
	}

	return true
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
	value || '-'

export const parseNumberValue = (
	value: string,
	maximumDecimals = 2,
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
	decimals = 2,
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
