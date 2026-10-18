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
	PROJECTS: withBasePath('/projects'),
	SINGLE_PROJECT: withBasePath('/projects/:projectId'),
	SELLING_INVOICES: withBasePath('/selling-invoices'),
	REPORTS: withBasePath('/reports'),
	DASHBOARD: withBasePath('/dashboard'),
	CASH_ACCOUNT_HISTORY: withBasePath('/dashboard/cash-history'),
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
	NEWSROOM: withBasePath('/newsroom'),
	NEWSROOM_ITEM: withBasePath('/newsroom/:releaseNoteId'),
	NEWSROOM_RELEASE_NOTES: withBasePath('/newsroom/release-notes'),
	NEWSROOM_RELEASE_NOTE_NEW: withBasePath('/newsroom/release-notes/new'),
	NEWSROOM_RELEASE_NOTE: withBasePath('/newsroom/release-notes/:releaseNoteId'),
	NEWSROOM_SETTINGS: withBasePath('/newsroom/settings'),
	CUSTOMER_MODAL: withBasePath('/customer-modal'),
	WILDCARD: '*',
}

export const buildRoutePath = {
	productById: (productId: string) => withBasePath(`/products/${productId}`),
	customerById: (customerId: string) =>
		withBasePath(`/customers/${customerId}`),
	projectById: (projectId: string) => withBasePath(`/projects/${projectId}`),
	supplierById: (supplierId: string) =>
		withBasePath(`/suppliers/${supplierId}`),
	partnerById: (partnerId: string) => withBasePath(`/partners/${partnerId}`),
	employeeById: (employeeId: string) =>
		withBasePath(`/employees/${employeeId}`),
	releaseNoteById: (releaseNoteId: string) =>
		withBasePath(`/newsroom/release-notes/${releaseNoteId}`),
	newsroomItem: (releaseNoteId: string) =>
		withBasePath(`/newsroom/${releaseNoteId}`),
}

export const fullPaths = {
	ROOT: RoutePaths.ROOT,
	PRODUCTS: RoutePaths.PRODUCTS,
	ALL_PRODUCTS: RoutePaths.PRODUCTS,
	PROJECTS: RoutePaths.PROJECTS,
	CUSTOMERS: RoutePaths.CUSTOMERS,
	CATEGORIES: RoutePaths.CATEGORIES,
	SUPPLIERS: RoutePaths.SUPPLIERS,
	PARTNERS: RoutePaths.PARTNERS,
	USERS: RoutePaths.USERS,
	EMPLOYEES: RoutePaths.EMPLOYEES,
	ADD_NEW_TENANT: RoutePaths.ADD_NEW_TENANT,
	TENANTS_LIST: RoutePaths.TENANTS_LIST,
	RENEWAL_REQUESTS: RoutePaths.RENEWAL_REQUESTS,
	NEWSROOM: RoutePaths.NEWSROOM,
	NEWSROOM_RELEASE_NOTES: RoutePaths.NEWSROOM_RELEASE_NOTES,
	NEWSROOM_RELEASE_NOTE_NEW: RoutePaths.NEWSROOM_RELEASE_NOTE_NEW,
	NEWSROOM_SETTINGS: RoutePaths.NEWSROOM_SETTINGS,
	SETTINGS: RoutePaths.SETTINGS,
	CUSTOMER_MODAL: RoutePaths.CUSTOMER_MODAL,
	SELLING_INVOICES: RoutePaths.SELLING_INVOICES,
	REPORTS: RoutePaths.REPORTS,
	DASHBOARD: RoutePaths.DASHBOARD,
	CASH_ACCOUNT_HISTORY: RoutePaths.CASH_ACCOUNT_HISTORY,
}

export const routeLabelKeys = {
	ROOT: 'navigation.welcome',
	PRODUCTS: 'components.pageHeaders.products',
	ALL_PRODUCTS: 'navigation.allProducts',
	PROJECTS: 'components.pageHeaders.projects',
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
	NEWSROOM: 'newsroom.title',
	NEWSROOM_RELEASE_NOTES: 'newsroom.releaseNotes',
	NEWSROOM_RELEASE_NOTE_NEW: 'newsroom.createNew',
	NEWSROOM_SETTINGS: 'newsroom.settings',
	STORE_PLATFORM: 'appTitle',
	SELLING_INVOICES: 'components.pageHeaders.sellingInvoices',
	REPORTS: 'components.pageHeaders.reports',
	DASHBOARD: 'components.pageHeaders.dashboard',
	CASH_ACCOUNT_HISTORY: 'dashboard.cashAccounts.historyTitle',
} as const

export const getRouteLabel = (path: string, fallback = '') => {
	const routeLabelKeyByPath: Record<string, string> = {
		[RoutePaths.ROOT]: routeLabelKeys.ROOT,
		[RoutePaths.PRODUCTS]: routeLabelKeys.PRODUCTS,
		[RoutePaths.PROJECTS]: routeLabelKeys.PROJECTS,
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
		[RoutePaths.NEWSROOM]: routeLabelKeys.NEWSROOM,
		[RoutePaths.NEWSROOM_RELEASE_NOTES]: routeLabelKeys.NEWSROOM_RELEASE_NOTES,
		[RoutePaths.NEWSROOM_SETTINGS]: routeLabelKeys.NEWSROOM_SETTINGS,
		[RoutePaths.SELLING_INVOICES]: routeLabelKeys.SELLING_INVOICES,
		[RoutePaths.REPORTS]: routeLabelKeys.REPORTS,
		[RoutePaths.DASHBOARD]: routeLabelKeys.DASHBOARD,
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
	const projects: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'projects',
			name: t(routeLabelKeys.PROJECTS),
			href: fullPaths.PROJECTS,
			isCurrentPage: true,
		},
	]
	const project: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'projects',
			name: t(routeLabelKeys.PROJECTS),
			href: fullPaths.PROJECTS,
			isCurrentPage: false,
		},
		{
			id: 'project',
			name: name ?? '',
			href: id ? buildRoutePath.projectById(id) : '',
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
	const newsroom: BreadcrumbItem[] = [
		{
			id: 'newsroom',
			name: t('newsroom.title'),
			href: fullPaths.NEWSROOM,
			isCurrentPage: !name,
		},
		...(name
			? [
					{
						id: 'newsroom-item',
						name,
						href: '#',
						isCurrentPage: true,
					},
				]
			: []),
	]
	const newsroomReleaseNotes: BreadcrumbItem[] = [
		{
			id: 'newsroom',
			name: t('newsroom.title'),
			href: fullPaths.NEWSROOM_RELEASE_NOTES,
			isCurrentPage: false,
		},
		{
			id: 'newsroom-release-notes',
			name: t(routeLabelKeys.NEWSROOM_RELEASE_NOTES),
			href: fullPaths.NEWSROOM_RELEASE_NOTES,
			isCurrentPage: true,
		},
	]
	const newsroomReleaseNoteEditor: BreadcrumbItem[] = [
		{
			id: 'newsroom',
			name: t('newsroom.title'),
			href: fullPaths.NEWSROOM_RELEASE_NOTES,
			isCurrentPage: false,
		},
		{
			id: 'newsroom-release-notes',
			name: t(routeLabelKeys.NEWSROOM_RELEASE_NOTES),
			href: fullPaths.NEWSROOM_RELEASE_NOTES,
			isCurrentPage: false,
		},
		{
			id: 'newsroom-release-note-editor',
			name: name || t('newsroom.createNew'),
			href: '#',
			isCurrentPage: true,
		},
	]
	const newsroomSettings: BreadcrumbItem[] = [
		{
			id: 'newsroom',
			name: t('newsroom.title'),
			href: fullPaths.NEWSROOM_SETTINGS,
			isCurrentPage: false,
		},
		{
			id: 'newsroom-settings',
			name: t(routeLabelKeys.NEWSROOM_SETTINGS),
			href: fullPaths.NEWSROOM_SETTINGS,
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
	const dashboard: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'dashboard',
			name: t(routeLabelKeys.DASHBOARD),
			href: fullPaths.DASHBOARD,
			isCurrentPage: true,
		},
	]
	const cashAccountHistory: BreadcrumbItem[] = [
		{
			id: 'store-platform',
			name: t(routeLabelKeys.STORE_PLATFORM),
			href: fullPaths.ROOT,
			isCurrentPage: false,
		},
		{
			id: 'dashboard',
			name: t(routeLabelKeys.DASHBOARD),
			href: fullPaths.DASHBOARD,
			isCurrentPage: false,
		},
		{
			id: 'cash-account-history',
			name: t(routeLabelKeys.CASH_ACCOUNT_HISTORY),
			href: fullPaths.CASH_ACCOUNT_HISTORY,
			isCurrentPage: true,
		},
	]

	return {
		StorePlatform,
		settings,
		allActivities,
		products,
		projects,
		project,
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
		newsroom,
		newsroomReleaseNotes,
		newsroomReleaseNoteEditor,
		newsroomSettings,
		product,
		sellingInvoices,
		reports,
		dashboard,
		cashAccountHistory,
	}
}
