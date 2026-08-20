import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), 'src/.env') })

const connectionString =
	process.env.BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING?.trim()
const jwtSecret = process.env.JWT_SECRET?.trim()
const refreshSecret = process.env.REFRESH_TOKEN_SECRET?.trim()

if (!connectionString) {
	throw new Error('Missing BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING.')
}

if (!jwtSecret) {
	throw new Error('Missing JWT_SECRET.')
}

if (!refreshSecret) {
	throw new Error('Missing REFRESH_TOKEN_SECRET.')
}

export const config = {
	environment: process.env.NODE_ENV || 'dev',
	logLevel: process.env.LOG_LEVEL ?? 'DEBUG',
	enableChangeStream: false,
	mongoDB: {
		authContext: {
			username: process.env.BUSINESS_PLATFORM_MONGO_DB_USERNAME || '',
			password: process.env.BUSINESS_PLATFORM_MONGO_DB_PASSWORD || '',
		},
		connectionString,
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
	jwtSecret,
	nodeEnv: process.env.NODE_ENV || 'dev',
	refreshSecret,
	refreshTokenTTLDays: 7,
	offlineSyncRetentionDays: parseInt(
		process.env.OFFLINE_SYNC_RETENTION_DAYS || '90',
		10,
	),
	cron: {
		dailySchedule: process.env.CRON_DAILY_SCHEDULE || '0 3 * * *',
		timezone: process.env.CRON_TIMEZONE || 'Asia/Amman',
	},
	aiInvoice: {
		provider: (
			process.env.AI_PROVIDER ||
			process.env.AI_INVOICE_PROVIDER ||
			'mock'
		).toLowerCase(),
		azure: {
			endpoint: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.trim() || '',
			key: process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY || '',
		},
		openai: {
			apiKey: process.env.OPENAI_API_KEY || '',
			model: process.env.OPENAI_INVOICE_MODEL || 'gpt-4o',
		},
		gemini: {
			apiKey: process.env.GEMINI_API_KEY || '',
			model: process.env.GEMINI_INVOICE_MODEL || 'gemini-3.5-flash-lite',
		},
	},
}
