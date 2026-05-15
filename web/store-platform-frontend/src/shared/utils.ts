import { config } from '../config'
import { Breakpoints } from './globalEnums'

export function compareBreakpoint(breakpoint: Breakpoints | undefined) {
	return {
		isMobile: breakpoint === Breakpoints.MOBILE || !breakpoint,
		isTablet: breakpoint === Breakpoints.TABLET || !breakpoint,
		isDesktop: breakpoint === Breakpoints.DESKTOP || !breakpoint,
		isLargeDesktop: breakpoint === Breakpoints.LARGE_DESKTOP || !breakpoint,
	}
}

export const getEnabledActions = () => {
	const enabledActions = new Set(config.actionsEnabled)

	return {
		isAddNewTenantEnabled: enabledActions.has('ADD_NEW_TENANT'),
		isTenantsListEnabled: enabledActions.has('TENANTS_LIST'),
		isBarcodeEnabled: enabledActions.has('BARCODE'),
		isProductsEnabled: enabledActions.has('PRODUCTS'),
		isOrdersEnabled: enabledActions.has('ORDERS'),
		isInvoicesEnabled: enabledActions.has('INVOICE'),
		isUsersEnabled: enabledActions.has('USERS'),
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
		isTenantOrdersEnabled: enabledTenantActions.has('ORDERS'),
		isTenantInvoicesEnabled: enabledTenantActions.has('INVOICE'),
		isTenantUsersEnabled: enabledTenantActions.has('USERS'),
		isTenantChangePasswordEnabled: enabledTenantActions.has('CHANGE_PASSWORD'),
	}
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
