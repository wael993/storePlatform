import { Customer } from './../../../../services/api-store-platform/src/models/Customer'
const ROUTE_PREFIX = '/services/store_platform'

const withBasePath = (suffix: string) => `${ROUTE_PREFIX}${suffix}`

export const RoutePaths = {
	ROOT: '/',
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
	SUPPLIERS: withBasePath('/suppliers'),
	USERS: withBasePath('/users'),
	SETTINGS: withBasePath('/settings'),
	ADD_NEW_TENANT: withBasePath('/add-new-tenant'),
	TENANTS_LIST: withBasePath('/tenants-list'),
	WILDCARD: '*',
}

export const buildRoutePath = {
	productById: (productId: string) => withBasePath(`/products/${productId}`),
}

export const fullPaths = {
	BARCODE: RoutePaths.BARCODE,
	PRODUCTS: RoutePaths.PRODUCTS,
	ALL_PRODUCTS: RoutePaths.PRODUCTS,
	DAILY: RoutePaths.DAILY,
	ORDERS: RoutePaths.ORDERS,
	INVOICES: RoutePaths.INVOICES,
	CUSTOMERS: RoutePaths.CUSTOMERS,
	SUPPLIERS: RoutePaths.SUPPLIERS,
	USERS: RoutePaths.USERS,
	ADD_NEW_TENANT: RoutePaths.ADD_NEW_TENANT,
	TENANTS_LIST: RoutePaths.TENANTS_LIST,
	SETTINGS: RoutePaths.SETTINGS,
}

export const generateBreadcrumbs = ({
	locationId,
	locationName,
}: BreadcrumbParams = {}) => {
	const settings: BreadcrumbItem[] = [
		{
			id: 'settings',
			name: 'Settings',
			href: '#',
			isCurrentPage: true,
		},
	]
	const StorePlatform: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: '#',
			isCurrentPage: true,
		},
	]

	const allActivities: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: fullPaths.PRODUCTS,
			isCurrentPage: false,
		},
		{
			id: 'all-products',
			name: 'All products',
			href: `${fullPaths.ALL_PRODUCTS}`,
			isCurrentPage: true,
		},
	]
	const products: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: fullPaths.PRODUCTS,
			isCurrentPage: false,
		},
		{
			id: 'products',
			name: 'Products',
			href: `${fullPaths.PRODUCTS}`,
			isCurrentPage: true,
		},
	]
	const barcode: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: fullPaths.PRODUCTS,
			isCurrentPage: false,
		},
		{
			id: 'barcode',
			name: 'Barcode',
			href: fullPaths.BARCODE,
			isCurrentPage: true,
		},
	]
	const orders: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: fullPaths.PRODUCTS,
			isCurrentPage: false,
		},
		{
			id: 'orders',
			name: 'Orders',
			href: fullPaths.ORDERS,
			isCurrentPage: true,
		},
	]
	const daily: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: fullPaths.PRODUCTS,
			isCurrentPage: false,
		},
		{
			id: 'daily',
			name: 'Daily',
			href: fullPaths.DAILY,
			isCurrentPage: true,
		},
	]
	const customers: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: fullPaths.PRODUCTS,
			isCurrentPage: false,
		},
		{
			id: 'customers',
			name: 'Customers',
			href: fullPaths.CUSTOMERS,
			isCurrentPage: true,
		},
	]
	const suppliers: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: fullPaths.PRODUCTS,
			isCurrentPage: false,
		},
		{
			id: 'suppliers',
			name: 'Suppliers',
			href: fullPaths.SUPPLIERS,
			isCurrentPage: true,
		},
	]
	const invoices: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: fullPaths.PRODUCTS,
			isCurrentPage: false,
		},
		{
			id: 'invoices',
			name: 'Invoices',
			href: fullPaths.INVOICES,
			isCurrentPage: true,
		},
	]
	const users: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: fullPaths.PRODUCTS,
			isCurrentPage: false,
		},
		{
			id: 'users',
			name: 'Users',
			href: `${fullPaths.USERS}`,
			isCurrentPage: true,
		},
	]
	const addNewTenant: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: fullPaths.ADD_NEW_TENANT,
			isCurrentPage: false,
		},
		{
			id: 'add-new-tenant',
			name: 'Add Tenant',
			href: fullPaths.ADD_NEW_TENANT,
			isCurrentPage: true,
		},
	]
	const tenantsList: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: 'Store Platform',
			href: fullPaths.ADD_NEW_TENANT,
			isCurrentPage: false,
		},
		{
			id: 'tenants-list',
			name: 'Tenants List',
			href: fullPaths.TENANTS_LIST,
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
		suppliers,
		users,
		addNewTenant,
		tenantsList,
	}
}
