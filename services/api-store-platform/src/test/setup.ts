process.env.JWT_SECRET ??= 'test-jwt-secret-at-least-32-characters'
process.env.REFRESH_TOKEN_SECRET ??= 'test-refresh-secret-at-least-32-chars'
process.env.BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING ??=
	'mongodb://127.0.0.1:27017/store-platform-test'
