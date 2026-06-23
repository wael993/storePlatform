export const TENANT_ACCESSIBLE_PAGE = {
	USERS: 'USERS',
	PRODUCTS: 'PRODUCTS',
	DAILY: 'DAILY',
	SUPPLIERS: 'SUPPLIERS',
	CUSTOMERS: 'CUSTOMERS',
	CATEGORIES: 'CATEGORIES',
	PARTNERS: 'PARTNERS',
	ORDERS: 'ORDERS',
	INVOICE: 'INVOICE',
	INVENTORY: 'INVENTORY',
	REPORTS: 'REPORTS',
	BARCODE: 'BARCODE',
	SETTINGS: 'SETTINGS',
} as const

export type TenantAccessiblePage =
	(typeof TENANT_ACCESSIBLE_PAGE)[keyof typeof TENANT_ACCESSIBLE_PAGE]

export const CONFIGURABLE_TENANT_PAGES: TenantAccessiblePage[] = [
	TENANT_ACCESSIBLE_PAGE.USERS,
	TENANT_ACCESSIBLE_PAGE.PRODUCTS,
	TENANT_ACCESSIBLE_PAGE.DAILY,
	TENANT_ACCESSIBLE_PAGE.SUPPLIERS,
	TENANT_ACCESSIBLE_PAGE.CUSTOMERS,
	TENANT_ACCESSIBLE_PAGE.CATEGORIES,
	TENANT_ACCESSIBLE_PAGE.PARTNERS,
	TENANT_ACCESSIBLE_PAGE.ORDERS,
	TENANT_ACCESSIBLE_PAGE.INVOICE,
	TENANT_ACCESSIBLE_PAGE.BARCODE,
	TENANT_ACCESSIBLE_PAGE.SETTINGS,
]

export const TENANT_PAGE_LABEL_KEYS: Record<TenantAccessiblePage, string> = {
	[TENANT_ACCESSIBLE_PAGE.USERS]: 'components.pageHeaders.users',
	[TENANT_ACCESSIBLE_PAGE.PRODUCTS]: 'components.pageHeaders.products',
	[TENANT_ACCESSIBLE_PAGE.DAILY]: 'components.pageHeaders.daily',
	[TENANT_ACCESSIBLE_PAGE.SUPPLIERS]: 'components.pageHeaders.suppliers',
	[TENANT_ACCESSIBLE_PAGE.CUSTOMERS]: 'components.pageHeaders.customers',
	[TENANT_ACCESSIBLE_PAGE.CATEGORIES]: 'components.pageHeaders.categories',
	[TENANT_ACCESSIBLE_PAGE.PARTNERS]: 'components.pageHeaders.partners',
	[TENANT_ACCESSIBLE_PAGE.ORDERS]: 'components.pageHeaders.orders',
	[TENANT_ACCESSIBLE_PAGE.INVOICE]: 'components.pageHeaders.invoices',
	[TENANT_ACCESSIBLE_PAGE.INVENTORY]: 'tenants.accessiblePages.inventory',
	[TENANT_ACCESSIBLE_PAGE.REPORTS]: 'tenants.accessiblePages.reports',
	[TENANT_ACCESSIBLE_PAGE.BARCODE]: 'navigation.barcode',
	[TENANT_ACCESSIBLE_PAGE.SETTINGS]: 'components.pageHeaders.settings',
}

export const TENANT_PAGE_DESCRIPTION_KEYS: Record<
	TenantAccessiblePage,
	string
> = {
	[TENANT_ACCESSIBLE_PAGE.USERS]: 'tenants.accessiblePages.usersDescription',
	[TENANT_ACCESSIBLE_PAGE.PRODUCTS]:
		'tenants.accessiblePages.productsDescription',
	[TENANT_ACCESSIBLE_PAGE.DAILY]: 'tenants.accessiblePages.dailyDescription',
	[TENANT_ACCESSIBLE_PAGE.SUPPLIERS]:
		'tenants.accessiblePages.suppliersDescription',
	[TENANT_ACCESSIBLE_PAGE.CUSTOMERS]:
		'tenants.accessiblePages.customersDescription',
	[TENANT_ACCESSIBLE_PAGE.CATEGORIES]:
		'tenants.accessiblePages.categoriesDescription',
	[TENANT_ACCESSIBLE_PAGE.PARTNERS]:
		'tenants.accessiblePages.partnersDescription',
	[TENANT_ACCESSIBLE_PAGE.ORDERS]: 'tenants.accessiblePages.ordersDescription',
	[TENANT_ACCESSIBLE_PAGE.INVOICE]:
		'tenants.accessiblePages.invoicesDescription',
	[TENANT_ACCESSIBLE_PAGE.INVENTORY]:
		'tenants.accessiblePages.inventoryDescription',
	[TENANT_ACCESSIBLE_PAGE.REPORTS]:
		'tenants.accessiblePages.reportsDescription',
	[TENANT_ACCESSIBLE_PAGE.BARCODE]:
		'tenants.accessiblePages.barcodeDescription',
	[TENANT_ACCESSIBLE_PAGE.SETTINGS]:
		'tenants.accessiblePages.settingsDescription',
}
