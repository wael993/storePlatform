import { config } from '../config'
import { Breakpoints, EntryType, TargetType } from './globalEnums'
import { parseNumberValue, toDotDecimal } from './numberParse'
import { RoutePaths } from './routes'
import { SEE } from './seeFlags'
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
		isInvoiceAiEnabled: enabledActions.has('INVOICE_AI'),
		isReportsEnabled: enabledActions.has('REPORTS'),
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
		INVOICE_AI: enabledActions.isInvoiceAiEnabled,
		INVENTORY: enabledActions.isProductsEnabled,
		REPORTS: enabledActions.isReportsEnabled,
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
		isTenantInvoiceAiEnabled: tenantPages.has('INVOICE_AI'),
		isTenantReportsEnabled: tenantPages.has('REPORTS'),
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
	canSee: (id: string) => boolean = () => true,
): boolean => {
	if (pathname === RoutePaths.ROOT || pathname === RoutePaths.STORE_PLATFORM) {
		return canSee(SEE.welcome)
	}

	if (pathname.startsWith(RoutePaths.LOGIN)) {
		return true
	}

	const routeChecks: Array<[string, boolean]> = [
		[
			RoutePaths.BARCODE,
			globalActions.isBarcodeEnabled &&
				tenantActions.isTenantBarcodeEnabled &&
				canSee(SEE.barcode),
		],
		[
			RoutePaths.PRODUCTS,
			globalActions.isProductsEnabled &&
				tenantActions.isTenantProductsEnabled &&
				canSee(SEE.products),
		],
		[
			RoutePaths.DAILY,
			globalActions.isDailyEnabled &&
				tenantActions.isTenantDailyEnabled &&
				canSee(SEE.daily),
		],
		[
			RoutePaths.ORDERS,
			globalActions.isOrdersEnabled &&
				tenantActions.isTenantOrdersEnabled &&
				canSee(SEE.orders),
		],
		[
			RoutePaths.INVOICES,
			globalActions.isInvoicesEnabled && tenantActions.isTenantInvoicesEnabled,
		],
		[
			RoutePaths.SELLING_INVOICES,
			globalActions.isSellingInvoicesEnabled &&
				tenantActions.isTenantSellingInvoicesEnabled &&
				canSee(SEE.invoices),
		],
		[
			RoutePaths.REPORTS,
			globalActions.isReportsEnabled &&
				tenantActions.isTenantReportsEnabled &&
				canSee(SEE.reports),
		],
		[
			RoutePaths.CUSTOMERS,
			globalActions.isCustomersEnabled &&
				tenantActions.isTenantCustomersEnabled &&
				canSee(SEE.customers),
		],
		[
			RoutePaths.CATEGORIES,
			globalActions.isCategoriesEnabled &&
				tenantActions.isTenantCategoriesEnabled &&
				canSee(SEE.categories),
		],
		[
			RoutePaths.SUPPLIERS,
			globalActions.isSuppliersEnabled &&
				tenantActions.isTenantSuppliersEnabled &&
				canSee(SEE.supplier),
		],
		[
			RoutePaths.PARTNERS,
			globalActions.isPartnersEnabled &&
				tenantActions.isTenantPartnersEnabled &&
				canSee(SEE.partners),
		],
		[
			RoutePaths.USERS,
			globalActions.isUsersEnabled &&
				tenantActions.isTenantUsersEnabled &&
				(canSee(SEE.usersInvite) || canSee(SEE.usersList)),
		],
		[
			RoutePaths.EMPLOYEES,
			globalActions.isEmployeesEnabled &&
				tenantActions.isTenantEmployeesEnabled &&
				canSee(SEE.employees),
		],
		[
			RoutePaths.SETTINGS,
			globalActions.isSettingsEnabled &&
				tenantActions.isTenantSettingsEnabled &&
				canSee(SEE.settings),
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
		[
			RoutePaths.RENEWAL_REQUESTS,
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

export const tenantHomePath = (canSee: (id: string) => boolean): string => {
	if (canSee(SEE.welcome)) return RoutePaths.ROOT
	if (canSee(SEE.products)) return RoutePaths.PRODUCTS
	if (canSee(SEE.invoices)) return RoutePaths.SELLING_INVOICES
	if (canSee(SEE.daily)) return RoutePaths.DAILY
	return RoutePaths.ROOT
}

export const mapFee = (fee?: string | number | null): string | undefined =>
	formatNumber(fee)

export { parseNumberValue }

export const formatNumber = (
	value: string | number | null | undefined,
	options?: { minimumDecimals?: number; maximumDecimals?: number },
): string | undefined => {
	if (typeof value === 'string') {
		value = toDotDecimal(value)
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
		minimumFractionDigits: options?.minimumDecimals ?? 0,
		maximumFractionDigits: options?.maximumDecimals ?? 2,
	})
	return formattedAmount
}

export const withNoValueFallback = (
	value: string | number | null | undefined,
) => (value == null || value === '' ? '-' : String(value))

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
