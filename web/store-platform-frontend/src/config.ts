declare const process: {
	env: Record<string, string | undefined>
}
const splitByComma = (value: string): string[] => {
	return value.split(',')
}

export const config = {
	serviceId:
		process.env.REACT_APP_SERVICE_ID ||
		process.env.VITE_SERVICE_ID ||
		'store-platform-frontend',

	endpoints: {
		storePlatformEndpoint:
			process.env.REACT_APP_BUSINESS_PLATFORM_ENDPOINT ??
			process.env.BUSINESS_PLATFORM_ENDPOINT ??
			'http://localhost:3001/api/data',
		persistenceServiceEndpoint:
			process.env.REACT_APP_PERSISTENCE_SERVICE_ENDPOINT ??
			process.env.VITE_PERSISTENCE_SERVICE_ENDPOINT ??
			process.env.REACT_APP_BUSINESS_PLATFORM_ENDPOINT ??
			process.env.BUSINESS_PLATFORM_ENDPOINT ??
			'http://localhost:3001/api/data',
	},
	actionsEnabled: splitByComma(
		process.env.VITE_ACTIONS_ENABLED ??
			'BARCODE,PRODUCTS,ORDERS,INVOICE,USERS,ADD_NEW_TENANT,TENANTS_LIST,CHANGE_PASSWORD,SETTINGS,DAILY', //'$VITE_ACTIONS_ENABLED',
	),
	tenantActions: splitByComma(
		process.env.VITE_TENANT_ACTIONS_ENABLED ??
			'BARCODE,PRODUCTS,ORDERS,INVOICE,USERS,ADD_NEW_TENANT,TENANTS_LIST,CHANGE_PASSWORD,SETTINGS,DAILY', //'$VITE_TENANT_ACTIONS_ENABLED',
	),
}
