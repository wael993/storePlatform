import dotenv from 'dotenv'
dotenv.config()

export const config = {
	environment: process.env.NODE_ENV || 'dev',
	logLevel: process.env.LOG_LEVEL ?? 'DEBUG',
	enableChangeStream: false,
	mongoDB: {
		authContext: {
			username: process.env.BUSINESS_PLATFORM_MONGO_DB_USERNAME || '',
			password: process.env.BUSINESS_PLATFORM_MONGO_DB_PASSWORD || '',
		},
		connectionString:
			process.env.BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING ||
			'mongodb+srv://business-platform-store-dev:xu7JDcWNF3G9QEt4d5wUmq@cluster0.jbysm.mongodb.net/bsp-BUSINESS-platform-store-dev',
		databaseName:
			process.env.BUSINESS_PLATFORM_MONGO_DB_DATABASE_NAME ||
			'bsp-BUSINESS-platform-store-dev',
	},
	redis: {
		enabled: 'false', // Set to false to disable Redis caching, or true to enable it. Can also be controlled via environment variables.
		// process.env.REDIS_ENABLED === 'true' ||
		// Boolean(process.env.REDIS_HOST && process.env.REDIS_PASSWORD),
		host: process.env.REDIS_HOST || 'knee-ultracozy-town-99731.db.redis.io',
		port: parseInt(process.env.REDIS_PORT || '11496', 10),
		username: process.env.REDIS_USERNAME || 'default',
		password: process.env.REDIS_PASSWORD || 'S3J7WHcJuA3Q5UfjjLxAliQSkv9izlpk',
		defaultTTLSeconds: parseInt(
			process.env.REDIS_CACHE_TTL_SECONDS || '60',
			10,
		),
	},
	port: process.env.PORT || 3001,
	jwtSecure:
		process.env.JWT_SECRET ||
		'323f83357220319819f3e9c651b73885f3446d9254eede2f29b90b47bdf0904e4f50c0f8e4088e11bc0b23757aad790dd5f067c4b97498848bb0fe6690aa3276',
	nodeEnv: process.env.NODE_ENV || 'dev',
	refreshSecret: process.env.REFRESH_SECRET || 'default_refresh_secret',
	refreshTokenTTLDays: 7,
}
