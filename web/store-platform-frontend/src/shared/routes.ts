import { t } from 'i18next'

const ROUTE_PREFIX = '/services/store_platform'

const withBasePath = (suffix: string) => `${ROUTE_PREFIX}${suffix}`

export const RoutePaths = {
	ROOT: withBasePath('/'),
	SERVICES: '/services',
	STORE_PLATFORM: ROUTE_PREFIX,
	LOGIN: withBasePath('/login'),
	BARCODE: withBasePath('/barcode'),
	PRODUCTS: withBasePath('/products'),
	SINGLE_PRODUCT: withBasePath('/products/:productId'),
	DAILY: withBasePath('/daily'),
	ORDERS: withBasePath('/orders'),
	INVOICES: withBasePath('/invoices'),
	CUSTOMERS: withBasePath('/customers'),
	SINGLE_CUSTOMER: withBasePath('/customers/:customerId'),
	CATEGORIES: withBasePath('/categories'),
	SUPPLIERS: withBasePath('/suppliers'),
	SINGLE_SUPPLIER: withBasePath('/suppliers/:supplierId'),
	PARTNERS: withBasePath('/partners'),
	SINGLE_PARTNER: withBasePath('/partners/:partnerId'),
	USERS: withBasePath('/users'),
	SETTINGS: withBasePath('/settings'),
	ADD_NEW_TENANT: withBasePath('/add-new-tenant'),
	TENANTS_LIST: withBasePath('/tenants-list'),
	CUSTOMER_MODAL: withBasePath('/customer-modal'),
	WILDCARD: '*',
}

export const buildRoutePath = {
	productById: (productId: string) => withBasePath(`/products/${productId}`),
	customerById: (customerId: string) =>
		withBasePath(`/customers/${customerId}`),
	supplierById: (supplierId: string) =>
		withBasePath(`/suppliers/${supplierId}`),
	partnerById: (partnerId: string) => withBasePath(`/partners/${partnerId}`),
}

export const fullPaths = {
	ROOT: RoutePaths.ROOT,
	BARCODE: RoutePaths.BARCODE,
	PRODUCTS: RoutePaths.PRODUCTS,
	ALL_PRODUCTS: RoutePaths.PRODUCTS,
	DAILY: RoutePaths.DAILY,
	ORDERS: RoutePaths.ORDERS,
	INVOICES: RoutePaths.INVOICES,
	CUSTOMERS: RoutePaths.CUSTOMERS,
	CATEGORIES: RoutePaths.CATEGORIES,
	SUPPLIERS: RoutePaths.SUPPLIERS,
	PARTNERS: RoutePaths.PARTNERS,
	USERS: RoutePaths.USERS,
	ADD_NEW_TENANT: RoutePaths.ADD_NEW_TENANT,
	TENANTS_LIST: RoutePaths.TENANTS_LIST,
	SETTINGS: RoutePaths.SETTINGS,
	CUSTOMER_MODAL: RoutePaths.CUSTOMER_MODAL,
}

export const routeLabelKeys = {
	ROOT: 'navigation.welcome',
	BARCODE: 'navigation.barcode',
	PRODUCTS: 'components.pageHeaders.products',
	PRODUCT: 'components.pageHeaders.product',
	ALL_PRODUCTS: 'navigation.allProducts',
	DAILY: 'components.pageHeaders.daily',
	ORDERS: 'components.pageHeaders.orders',
	INVOICES: 'components.pageHeaders.invoices',
	CUSTOMERS: 'components.pageHeaders.customers',
	CUSTOMER: 'components.pageHeaders.customer',
	CATEGORIES: 'components.pageHeaders.categories',
	SUPPLIERS: 'components.pageHeaders.suppliers',
	SUPPLIER: 'components.pageHeaders.supplier',
	PARTNERS: 'components.pageHeaders.partners',
	PARTNER: 'components.pageHeaders.partner',
	USERS: 'components.pageHeaders.users',
	SETTINGS: 'components.pageHeaders.settings',
	ADD_NEW_TENANT: 'navigation.addTenant',
	TENANTS_LIST: 'tenants.title',
	STORE_PLATFORM: 'appTitle',
} as const

export const getRouteLabel = (path: string, fallback = '') => {
	const routeLabelKeyByPath: Record<string, string> = {
		[RoutePaths.ROOT]: routeLabelKeys.ROOT,
		[RoutePaths.BARCODE]: routeLabelKeys.BARCODE,
		[RoutePaths.PRODUCTS]: routeLabelKeys.PRODUCTS,
		[RoutePaths.DAILY]: routeLabelKeys.DAILY,
		[RoutePaths.ORDERS]: routeLabelKeys.ORDERS,
		[RoutePaths.INVOICES]: routeLabelKeys.INVOICES,
		[RoutePaths.CUSTOMERS]: routeLabelKeys.CUSTOMERS,
		[RoutePaths.CATEGORIES]: routeLabelKeys.CATEGORIES,
		[RoutePaths.SUPPLIERS]: routeLabelKeys.SUPPLIERS,
		[RoutePaths.PARTNERS]: routeLabelKeys.PARTNERS,
		[RoutePaths.USERS]: routeLabelKeys.USERS,
		[RoutePaths.SETTINGS]: routeLabelKeys.SETTINGS,
		[RoutePaths.ADD_NEW_TENANT]: routeLabelKeys.ADD_NEW_TENANT,
		[RoutePaths.TENANTS_LIST]: routeLabelKeys.TENANTS_LIST,
	}
	const labelKey = routeLabelKeyByPath[path]

	return labelKey ? t(labelKey) : fallback
}

export const generateBreadcrumbs = (params?: BreadcrumbParams) => {
	const { id, name } = params ?? {}

	const settings: BreadcrumbItem[] = [
		{
			id: 'settings',
			name: t(routeLabelKeys.SETTINGS),
			href: '#',
			isCurrentPage: true,
		},
	]
	const StorePlatform: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: true,
		},
	]

	const allActivities: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'all-products',
			name: t(routeLabelKeys.ALL_PRODUCTS),
			href: `${fullPaths.ALL_PRODUCTS}`,
			isCurrentPage: true,
		},
	]
	const products: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'products',
			name: t(routeLabelKeys.PRODUCTS),
			href: `${fullPaths.PRODUCTS}`,
			isCurrentPage: true,
		},
	]
	const barcode: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'barcode',
			name: t(routeLabelKeys.BARCODE),
			href: fullPaths.BARCODE,
			isCurrentPage: true,
		},
		{
			id: 'product',
			name: t(routeLabelKeys.PRODUCT),
			href: fullPaths.PRODUCTS,
			isCurrentPage: true,
		},
	]
	const orders: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'orders',
			name: t(routeLabelKeys.ORDERS),
			href: fullPaths.ORDERS,
			isCurrentPage: true,
		},
	]
	const daily: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'daily',
			name: t(routeLabelKeys.DAILY),
			href: fullPaths.DAILY,
			isCurrentPage: true,
		},
	]
	const customers: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'customers',
			name: t(routeLabelKeys.CUSTOMERS),
			href: fullPaths.CUSTOMERS,
			isCurrentPage: true,
		},
	]
	const categories: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'categories',
			name: t(routeLabelKeys.CATEGORIES),
			href: fullPaths.CATEGORIES,
			isCurrentPage: true,
		},
	]
	const customer: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'customers',
			name: t(routeLabelKeys.CUSTOMERS),
			href: fullPaths.CUSTOMERS,
			isCurrentPage: false,
		},
		{
			id: 'customer',
			name: name ?? '',
			href: id ? buildRoutePath.customerById(id) : '',
			isCurrentPage: true,
		},
	]
	const suppliers: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'suppliers',
			name: t(routeLabelKeys.SUPPLIERS),
			href: fullPaths.SUPPLIERS,
			isCurrentPage: true,
		},
	]
	const supplier: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'suppliers',
			name: t(routeLabelKeys.SUPPLIERS),
			href: fullPaths.SUPPLIERS,
			isCurrentPage: false,
		},
		{
			id: 'supplier',
			name: name ?? '',
			href: id ? buildRoutePath.supplierById(id) : '',
			isCurrentPage: true,
		},
	]
	const partners: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'partners',
			name: t(routeLabelKeys.PARTNERS),
			href: fullPaths.PARTNERS,
			isCurrentPage: true,
		},
	]
	const partner: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'partners',
			name: t(routeLabelKeys.PARTNERS),
			href: fullPaths.PARTNERS,
			isCurrentPage: false,
		},
		{
			id: 'partner',
			name: name ?? '',
			href: id ? buildRoutePath.partnerById(id) : '',
			isCurrentPage: true,
		},
	]
	const invoices: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'invoices',
			name: t(routeLabelKeys.INVOICES),
			href: fullPaths.INVOICES,
			isCurrentPage: true,
		},
	]
	const users: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'users',
			name: t(routeLabelKeys.USERS),
			href: `${fullPaths.USERS}`,
			isCurrentPage: true,
		},
	]
	const addNewTenant: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ADD_NEW_TENANT,
			isCurrentPage: false,
		},
		{
			id: 'add-new-tenant',
			name: t(routeLabelKeys.ADD_NEW_TENANT),
			href: fullPaths.ADD_NEW_TENANT,
			isCurrentPage: true,
		},
	]
	const tenantsList: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ADD_NEW_TENANT,
			isCurrentPage: false,
		},
		{
			id: 'tenants-list',
			name: t(routeLabelKeys.TENANTS_LIST),
			href: fullPaths.TENANTS_LIST,
			isCurrentPage: true,
		},
	]
	const product: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'products',
			name: t(routeLabelKeys.PRODUCTS),
			href: fullPaths.PRODUCTS,
			isCurrentPage: false,
		},
		{
			id: 'product',
			name: name ?? '',
			href: id ? buildRoutePath.productById(id) : '',
			isCurrentPage: true,
		},
	]

	return {
		StorePlatform,
		settings,
		allActivities,
		barcode,
		products,
		orders,
		daily,
		invoices,
		customers,
		categories,
		customer,
		suppliers,
		supplier,
		partners,
		partner,
		users,
		addNewTenant,
		tenantsList,
		product,
	}
}
