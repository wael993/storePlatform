// `.env` points DATABASE_URL at a real (staging) database. Tests only ever use
// TEST_DATABASE_URL; an empty value also keeps dotenv from filling it in later.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? ''
process.env.JWT_SECRET ??= 'test-jwt-secret-at-least-32-characters'
process.env.REFRESH_TOKEN_SECRET ??= 'test-refresh-secret-at-least-32-chars'
process.env.SUPER_ADMIN_TENANT_ID ??= 'super-admin'
process.env.BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING ??=
	'mongodb://127.0.0.1:27017/store-platform-test'

process.env.BACKUP_MASTER_KEY ??= Buffer.alloc(32, 7).toString('base64')
