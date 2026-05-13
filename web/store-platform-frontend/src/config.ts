declare const process: {
	env: Record<string, string | undefined>
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
}
