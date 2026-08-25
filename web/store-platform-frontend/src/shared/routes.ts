import { t } from 'i18next'

const ROUTE_PREFIX = '/services/store_platform'

const withBasePath = (suffix: string) => `${ROUTE_PREFIX}${suffix}`

export const RoutePaths = {
	ROOT: withBasePath('/'),
	SERVICES: '/services',
	STORE_PLATFORM: ROUTE_PREFIX,
	LOGIN: withBasePath('/login'),
	PRODUCTS: withBasePath('/products'),
	SINGLE_PRODUCT: withBasePath('/products/:productId'),
	DAILY: withBasePath('/daily'),
	ORDERS: withBasePath('/orders'),
	INVOICES: withBasePath('/invoices'),
	SELLING_INVOICES: withBasePath('/selling-invoices'),
	REPORTS: withBasePath('/reports'),
	CUSTOMERS: withBasePath('/customers'),
	SINGLE_CUSTOMER: withBasePath('/customers/:customerId'),
	CATEGORIES: withBasePath('/categories'),
	SUPPLIERS: withBasePath('/suppliers'),
	SINGLE_SUPPLIER: withBasePath('/suppliers/:supplierId'),
	PARTNERS: withBasePath('/partners'),
	SINGLE_PARTNER: withBasePath('/partners/:partnerId'),
	USERS: withBasePath('/users'),
	EMPLOYEES: withBasePath('/employees'),
	SINGLE_EMPLOYEE: withBasePath('/employees/:employeeId'),
	SETTINGS: withBasePath('/settings'),
	ADD_NEW_TENANT: withBasePath('/add-new-tenant'),
	TENANTS_LIST: withBasePath('/tenants-list'),
	RENEWAL_REQUESTS: withBasePath('/renewal-requests'),
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
	employeeById: (employeeId: string) =>
		withBasePath(`/employees/${employeeId}`),
}

export const fullPaths = {
	ROOT: RoutePaths.ROOT,
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
	EMPLOYEES: RoutePaths.EMPLOYEES,
	ADD_NEW_TENANT: RoutePaths.ADD_NEW_TENANT,
	TENANTS_LIST: RoutePaths.TENANTS_LIST,
	RENEWAL_REQUESTS: RoutePaths.RENEWAL_REQUESTS,
	SETTINGS: RoutePaths.SETTINGS,
	CUSTOMER_MODAL: RoutePaths.CUSTOMER_MODAL,
	SELLING_INVOICES: RoutePaths.SELLING_INVOICES,
	REPORTS: RoutePaths.REPORTS,
}

export const routeLabelKeys = {
	ROOT: 'navigation.welcome',
	PRODUCTS: 'components.pageHeaders.products',
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
	EMPLOYEES: 'components.pageHeaders.employees',
	EMPLOYEE: 'components.pageHeaders.employee',
	SETTINGS: 'components.pageHeaders.settings',
	ADD_NEW_TENANT: 'navigation.addTenant',
	TENANTS_LIST: 'tenants.title',
	RENEWAL_REQUESTS: 'tenants.renewalRequests',
	STORE_PLATFORM: 'appTitle',
	SELLING_INVOICES: 'components.pageHeaders.sellingInvoices',
	REPORTS: 'components.pageHeaders.reports',
} as const

export const getRouteLabel = (path: string, fallback = '') => {
	const routeLabelKeyByPath: Record<string, string> = {
		[RoutePaths.ROOT]: routeLabelKeys.ROOT,
		[RoutePaths.PRODUCTS]: routeLabelKeys.PRODUCTS,
		[RoutePaths.DAILY]: routeLabelKeys.DAILY,
		[RoutePaths.ORDERS]: routeLabelKeys.ORDERS,
		[RoutePaths.INVOICES]: routeLabelKeys.INVOICES,
		[RoutePaths.CUSTOMERS]: routeLabelKeys.CUSTOMERS,
		[RoutePaths.CATEGORIES]: routeLabelKeys.CATEGORIES,
		[RoutePaths.SUPPLIERS]: routeLabelKeys.SUPPLIERS,
		[RoutePaths.PARTNERS]: routeLabelKeys.PARTNERS,
		[RoutePaths.USERS]: routeLabelKeys.USERS,
		[RoutePaths.EMPLOYEES]: routeLabelKeys.EMPLOYEES,
		[RoutePaths.SETTINGS]: routeLabelKeys.SETTINGS,
		[RoutePaths.ADD_NEW_TENANT]: routeLabelKeys.ADD_NEW_TENANT,
		[RoutePaths.TENANTS_LIST]: routeLabelKeys.TENANTS_LIST,
		[RoutePaths.RENEWAL_REQUESTS]: routeLabelKeys.RENEWAL_REQUESTS,
		[RoutePaths.SELLING_INVOICES]: routeLabelKeys.SELLING_INVOICES,
		[RoutePaths.REPORTS]: routeLabelKeys.REPORTS,
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
	const sellingInvoices: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'selling-invoices',
			name: t(routeLabelKeys.SELLING_INVOICES),
			href: fullPaths.SELLING_INVOICES,
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
	const employees: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'employees',
			name: t(routeLabelKeys.EMPLOYEES),
			href: RoutePaths.EMPLOYEES,
			isCurrentPage: true,
		},
	]
	const employee: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'employees',
			name: t(routeLabelKeys.EMPLOYEES),
			href: RoutePaths.EMPLOYEES,
			isCurrentPage: false,
		},
		{
			id: 'employee',
			name: name ?? '',
			href: id ? buildRoutePath.employeeById(id) : '',
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
	const renewalRequests: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ADD_NEW_TENANT,
			isCurrentPage: false,
		},
		{
			id: 'renewal-requests',
			name: t(routeLabelKeys.RENEWAL_REQUESTS),
			href: fullPaths.RENEWAL_REQUESTS,
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
	const reports: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'reports',
			name: t(routeLabelKeys.REPORTS),
			href: fullPaths.REPORTS,
			isCurrentPage: true,
		},
	]

	return {
		StorePlatform,
		settings,
		allActivities,
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
		employees,
		employee,
		addNewTenant,
		tenantsList,
		renewalRequests,
		product,
		sellingInvoices,
		reports,
	}
}
