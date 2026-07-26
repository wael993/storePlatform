import { isSuperAdminTenant } from '../Permissions'
import { ITenant } from '../../models/Tenant'
import {
	resolveTenantAccessiblePages,
	SUPER_ADMIN_TENANT_PAGES,
	TENANT_ACCESSIBLE_PAGE,
	TenantAccessiblePage,
} from './tenantAccessiblePages'

const API_BASE_PATH = '/api/data'

const ENTITY_TYPE_TO_PAGE: Record<string, TenantAccessiblePage> = {
	customer: TENANT_ACCESSIBLE_PAGE.CUSTOMERS,
	customers: TENANT_ACCESSIBLE_PAGE.CUSTOMERS,
	supplier: TENANT_ACCESSIBLE_PAGE.SUPPLIERS,
	suppliers: TENANT_ACCESSIBLE_PAGE.SUPPLIERS,
	partner: TENANT_ACCESSIBLE_PAGE.PARTNERS,
	partners: TENANT_ACCESSIBLE_PAGE.PARTNERS,
}

const API_SEGMENT_TO_PAGES: Record<string, TenantAccessiblePage[]> = {
	products: [TENANT_ACCESSIBLE_PAGE.PRODUCTS],
	product: [TENANT_ACCESSIBLE_PAGE.PRODUCTS],
	'filter-values': [TENANT_ACCESSIBLE_PAGE.PRODUCTS],
	orders: [TENANT_ACCESSIBLE_PAGE.ORDERS],
	invoices: [
		TENANT_ACCESSIBLE_PAGE.INVOICE,
		TENANT_ACCESSIBLE_PAGE.SELLING_INVOICES,
	],
	'selling-invoices': [
		TENANT_ACCESSIBLE_PAGE.INVOICE,
		TENANT_ACCESSIBLE_PAGE.SELLING_INVOICES,
	],
	'buying-invoices': [
		TENANT_ACCESSIBLE_PAGE.INVOICE,
		TENANT_ACCESSIBLE_PAGE.SELLING_INVOICES,
	],
	inventory: [TENANT_ACCESSIBLE_PAGE.INVENTORY],
	reports: [TENANT_ACCESSIBLE_PAGE.REPORTS],
	'daily-actions': [
		TENANT_ACCESSIBLE_PAGE.DAILY,
		TENANT_ACCESSIBLE_PAGE.BARCODE,
		TENANT_ACCESSIBLE_PAGE.SELLING_INVOICES,
	],
	suppliers: [TENANT_ACCESSIBLE_PAGE.SUPPLIERS],
	customers: [TENANT_ACCESSIBLE_PAGE.CUSTOMERS],
	categories: [TENANT_ACCESSIBLE_PAGE.CATEGORIES],
	partners: [TENANT_ACCESSIBLE_PAGE.PARTNERS],
	users: [TENANT_ACCESSIBLE_PAGE.USERS],
	user: [TENANT_ACCESSIBLE_PAGE.USERS],
	expenses: [
		TENANT_ACCESSIBLE_PAGE.DAILY,
		TENANT_ACCESSIBLE_PAGE.SELLING_INVOICES,
	],
	currencies: [TENANT_ACCESSIBLE_PAGE.SETTINGS],
	'currency-settings': [TENANT_ACCESSIBLE_PAGE.SETTINGS],
	units: [TENANT_ACCESSIBLE_PAGE.SETTINGS],
	'user-settings': [TENANT_ACCESSIBLE_PAGE.SETTINGS],
	tenants: [
		TENANT_ACCESSIBLE_PAGE.TENANTS_LIST,
		TENANT_ACCESSIBLE_PAGE.ADD_NEW_TENANT,
	],
}

const UNRESTRICTED_API_SEGMENTS = new Set([
	'login',
	'refresh',
	'logout',
	'logout-all',
])

export const resolveAccessiblePagesForTenant = (
	tenant: Pick<ITenant, 'tenantId' | 'name' | 'domain' | 'accessiblePages'>,
): TenantAccessiblePage[] => {
	const pages = resolveTenantAccessiblePages(tenant)

	if (isSuperAdminTenant(tenant)) {
		return [...new Set([...pages, ...SUPER_ADMIN_TENANT_PAGES])]
	}

	return pages
}

export const getRequiredAccessiblePages = (
	requestPath: string,
	method: string,
): TenantAccessiblePage[] | null => {
	const normalizedPath = requestPath.split('?')[0]

	const relativePath = normalizedPath.startsWith(API_BASE_PATH)
		? normalizedPath.slice(API_BASE_PATH.length)
		: normalizedPath

	const segments = relativePath.split('/').filter(Boolean)
	const [firstSegment, secondSegment, thirdSegment] = segments

	if (!firstSegment || UNRESTRICTED_API_SEGMENTS.has(firstSegment)) {
		return null
	}

	if (
		firstSegment === 'users' &&
		secondSegment === 'me' &&
		thirdSegment === 'password'
	) {
		return null
	}

	if (firstSegment === 'budget-overview') {
		const entityPage = ENTITY_TYPE_TO_PAGE[secondSegment?.toLowerCase() ?? '']

		return entityPage ? [entityPage] : null
	}

	if (firstSegment === 'tenants' && method === 'POST') {
		return [TENANT_ACCESSIBLE_PAGE.ADD_NEW_TENANT]
	}

	if (firstSegment === 'tenants') {
		return [TENANT_ACCESSIBLE_PAGE.TENANTS_LIST]
	}

	return API_SEGMENT_TO_PAGES[firstSegment] ?? null
}

export const tenantHasRequiredPageAccess = (
	accessiblePages: TenantAccessiblePage[],
	requiredPages: TenantAccessiblePage[] | null,
): boolean => {
	if (!requiredPages?.length) {
		return true
	}

	const enabledPages = new Set(accessiblePages)

	return requiredPages.some(page => enabledPages.has(page))
}
