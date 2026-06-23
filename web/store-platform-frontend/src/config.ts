declare const process: {
	env: Record<string, string | undefined>
}
const splitByComma = (value: string): string[] => {
	return value.split(',')
}

const resolveApiEndpoint = (): string => {
	const fromEnv =
		process.env.REACT_APP_BUSINESS_PLATFORM_ENDPOINT ??
		process.env.BUSINESS_PLATFORM_ENDPOINT

	if (process.env.NODE_ENV === 'production') {
		// Same-origin path proxied to Render via vercel.json (first-party cookies on mobile)
		if (!fromEnv || fromEnv.includes('onrender.com')) {
			return '/api/data'
		}
		return fromEnv
	}

	if (fromEnv) {
		return fromEnv
	}

	return 'http://localhost:3001/api/data'
}

const apiEndpoint = resolveApiEndpoint()

export const config = {
	serviceId:
		process.env.REACT_APP_SERVICE_ID ||
		process.env.VITE_SERVICE_ID ||
		'store-platform-frontend',

	endpoints: {
		storePlatformEndpoint: apiEndpoint,
		persistenceServiceEndpoint:
			process.env.REACT_APP_PERSISTENCE_SERVICE_ENDPOINT ??
			process.env.VITE_PERSISTENCE_SERVICE_ENDPOINT ??
			apiEndpoint,
	},
	actionsEnabled: splitByComma(
		process.env.VITE_ACTIONS_ENABLED ??
			'PRODUCTS,ADD_NEW_TENANT,TENANTS_LIST,DAILY,CUSTOMERS,CATEGORIES,SUPPLIERS,PARTNERS,SETTINGS,USERS,BARCODE', //,,ORDERS,INVOICE,USERS,CHANGE_PASSWORD,SETTINGS', //'$VITE_ACTIONS_ENABLED',
	),
	tenantActions: splitByComma(
		process.env.VITE_TENANT_ACTIONS_ENABLED ??
			'BARCODE,PRODUCTS,ORDERS,INVOICE,USERS,ADD_NEW_TENANT,TENANTS_LIST,CHANGE_PASSWORD,DAILY,CUSTOMERS,CATEGORIES,SUPPLIERS,PARTNERS,SETTINGS,CATEGORIES',
	),
}
