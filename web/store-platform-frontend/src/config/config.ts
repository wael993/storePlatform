export const config = {
	endpoints: {
		marketingPlatformEndpoint:
			process.env.BUSINESS_PLATFORM_ENDPOINT ?? '$BUSINESS_PLATFORM_ENDPOINT',
	},
}
