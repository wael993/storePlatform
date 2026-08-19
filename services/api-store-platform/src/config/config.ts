import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), 'src/.env') })

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
		enabled:
			process.env.REDIS_ENABLED === 'true' &&
			Boolean(process.env.REDIS_HOST?.trim() && process.env.REDIS_PASSWORD),
		host: process.env.REDIS_HOST?.trim() || '',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		username: process.env.REDIS_USERNAME?.trim() || 'default',
		password: process.env.REDIS_PASSWORD || '',
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
	refreshSecret:
		process.env.REFRESH_SECRET ||
		process.env.REFRESH_TOKEN_SECRET ||
		'default_refresh_secret',
	refreshTokenTTLDays: 7,
	offlineSyncRetentionDays: parseInt(
		process.env.OFFLINE_SYNC_RETENTION_DAYS || '90',
		10,
	),
	cron: {
		dailySchedule: process.env.CRON_DAILY_SCHEDULE || '0 3 * * *',
		timezone: process.env.CRON_TIMEZONE || 'Asia/Amman',
	},
}
