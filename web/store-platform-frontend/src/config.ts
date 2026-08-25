const splitByComma = (value: string): string[] =>
	value
		.split(',')
		.map(item => item.trim().replace(/^['"]|['"]$/g, ''))
		.filter(Boolean)

const resolveApiEndpoint = (): string => {
	if (import.meta.env.DEV) {
		return (
			import.meta.env.VITE_BUSINESS_PLATFORM_ENDPOINT ??
			'http://localhost:3001/api/data'
		)
	}

	// Same-origin path proxied to Render via vercel.json (first-party cookies on mobile).
	return '/api/data'
}

const apiEndpoint = resolveApiEndpoint()

export const config = {
	environment:
		import.meta.env.VITE_ENVIRONMENT ??
		(import.meta.env.DEV ? 'local' : undefined),
	serviceId: import.meta.env.VITE_SERVICE_ID || 'store-platform-frontend',
	endpoints: {
		storePlatformEndpoint: apiEndpoint,
		persistenceServiceEndpoint:
			import.meta.env.VITE_PERSISTENCE_SERVICE_ENDPOINT ?? apiEndpoint,
	},
	actionsEnabled: splitByComma(
		import.meta.env.VITE_ACTIONS_ENABLED ??
			'PRODUCTS,ADD_NEW_TENANT,TENANTS_LIST,DAILY,CUSTOMERS,CATEGORIES,SUPPLIERS,PARTNERS,SETTINGS,USERS,EMPLOYEES,SELLING_INVOICES,INVOICE_AI,INVOICE,REPORTS,CHANGE_PASSWORD,SETTINGS,ORDERS',
	),
	tenantActions: splitByComma(
		import.meta.env.VITE_TENANT_ACTIONS_ENABLED ??
			'PRODUCTS,ADD_NEW_TENANT,TENANTS_LIST,DAILY,CUSTOMERS,CATEGORIES,SUPPLIERS,PARTNERS,SETTINGS,USERS,EMPLOYEES,SELLING_INVOICES,INVOICE_AI,INVOICE,REPORTS,CHANGE_PASSWORD,SETTINGS,ORDERS',
	),
}
