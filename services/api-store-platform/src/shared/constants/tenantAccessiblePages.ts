export const TENANT_ACCESSIBLE_PAGE = {
	USERS: 'USERS',
	PRODUCTS: 'PRODUCTS',
	DAILY: 'DAILY',
	SUPPLIERS: 'SUPPLIERS',
	CUSTOMERS: 'CUSTOMERS',
	PARTNERS: 'PARTNERS',
	ORDERS: 'ORDERS',
	INVOICE: 'INVOICE',
	INVENTORY: 'INVENTORY',
	REPORTS: 'REPORTS',
	BARCODE: 'BARCODE',
	SETTINGS: 'SETTINGS',
	ADD_NEW_TENANT: 'ADD_NEW_TENANT',
	TENANTS_LIST: 'TENANTS_LIST',
} as const

export type TenantAccessiblePage =
	(typeof TENANT_ACCESSIBLE_PAGE)[keyof typeof TENANT_ACCESSIBLE_PAGE]

export const CONFIGURABLE_TENANT_PAGES: TenantAccessiblePage[] = [
	TENANT_ACCESSIBLE_PAGE.USERS,
	TENANT_ACCESSIBLE_PAGE.PRODUCTS,
	TENANT_ACCESSIBLE_PAGE.DAILY,
	TENANT_ACCESSIBLE_PAGE.SUPPLIERS,
	TENANT_ACCESSIBLE_PAGE.CUSTOMERS,
	TENANT_ACCESSIBLE_PAGE.PARTNERS,
	TENANT_ACCESSIBLE_PAGE.ORDERS,
	TENANT_ACCESSIBLE_PAGE.INVOICE,
	TENANT_ACCESSIBLE_PAGE.BARCODE,
	TENANT_ACCESSIBLE_PAGE.SETTINGS,
]

export const DEFAULT_TENANT_ACCESSIBLE_PAGES: TenantAccessiblePage[] = [
	TENANT_ACCESSIBLE_PAGE.USERS,
	TENANT_ACCESSIBLE_PAGE.SETTINGS,
]

export const SUPER_ADMIN_TENANT_PAGES: TenantAccessiblePage[] = [
	TENANT_ACCESSIBLE_PAGE.ADD_NEW_TENANT,
	TENANT_ACCESSIBLE_PAGE.TENANTS_LIST,
]

const configurablePageSet = new Set<string>(CONFIGURABLE_TENANT_PAGES)

export const sanitizeAccessiblePages = (
	pages: string[] | undefined,
): TenantAccessiblePage[] => {
	if (!pages?.length) {
		return []
	}

	return pages.filter((page): page is TenantAccessiblePage =>
		configurablePageSet.has(page),
	)
}

export const resolveTenantAccessiblePages = (tenant: {
	accessiblePages?: string[]
}): TenantAccessiblePage[] => {
	const stored = sanitizeAccessiblePages(tenant.accessiblePages)

	if (stored.length) {
		return stored
	}

	return [...DEFAULT_TENANT_ACCESSIBLE_PAGES]
}
