declare const process: {
	env: Record<string, string | undefined>
}

const splitByComma = (value: string): string[] =>
	value
		.split(',')
		.map(item => item.trim().replace(/^['"]|['"]$/g, ''))
		.filter(Boolean)

const resolveApiEndpoint = (): string => {
	const fromEnv =
		process.env.REACT_APP_BUSINESS_PLATFORM_ENDPOINT ??
		'http://localhost:3001/api/data'

	if (process.env.NODE_ENV === 'production') {
		// Same-origin path proxied to Render via vercel.json (first-party cookies on mobile)
		if (!fromEnv || fromEnv.includes('onrender.com')) {
			return '/api/data'
		}
		return fromEnv
	}

	return 'http://localhost:3001/api/data'
}

const apiEndpoint = resolveApiEndpoint()

export const config = {
	environment:
		process.env.REACT_APP_ENVIRONMENT ??
		(process.env.NODE_ENV === 'development' ? 'local' : undefined),
	serviceId: process.env.REACT_APP_SERVICE_ID || 'store-platform-frontend',
	endpoints: {
		storePlatformEndpoint: apiEndpoint,
		persistenceServiceEndpoint:
			process.env.REACT_APP_PERSISTENCE_SERVICE_ENDPOINT ?? apiEndpoint,
	},
	actionsEnabled: splitByComma(
		process.env.REACT_APP_ACTIONS_ENABLED ??
			'PRODUCTS,ADD_NEW_TENANT,TENANTS_LIST,DAILY,CUSTOMERS,CATEGORIES,SUPPLIERS,PARTNERS,SETTINGS,USERS,EMPLOYEES,BARCODE,SELLING_INVOICES,INVOICE_AI,INVOICE,CHANGE_PASSWORD,SETTINGS,ORDERS',
	),
	tenantActions: splitByComma(
		process.env.REACT_APP_TENANT_ACTIONS_ENABLED ??
			'PRODUCTS,ADD_NEW_TENANT,TENANTS_LIST,DAILY,CUSTOMERS,CATEGORIES,SUPPLIERS,PARTNERS,SETTINGS,USERS,EMPLOYEES,BARCODE,SELLING_INVOICES,INVOICE_AI,INVOICE,CHANGE_PASSWORD,SETTINGS,ORDERS',
	),
}
