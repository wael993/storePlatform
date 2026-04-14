export const config = {
	serviceId: process.env.VITE_SERVICE_ID || '$VITE_SERVICE_ID',

	endpoints: {
		storePlatformEndpoint:
			process.env.BUSINESS_PLATFORM_ENDPOINT ??
			'http://localhost:3001/api/data',
		persistenceServiceEndpoint:
			process.env.VITE_PERSISTENCE_SERVICE_ENDPOINT ??
			'$VITE_PERSISTENCE_SERVICE_ENDPOINT',
	},
}
