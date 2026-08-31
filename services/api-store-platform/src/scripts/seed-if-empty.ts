import { spawnSync } from 'node:child_process'
import mongoose from 'mongoose'
import { config } from '../config/config'
import Tenant from '../models/Tenant'

// must match seed-app-tenant.ts TENANT_ID
const APP_TENANT_ID = 'app'
const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@example.com'
const DEFAULT_SUPER_ADMIN_PASSWORD = 'admin1234'
const DEFAULT_SUPER_ADMIN_TENANT_ID = 'super-admin'

const seedEnv = (): NodeJS.ProcessEnv => ({
	...process.env,
	SUPER_ADMIN_EMAIL:
		process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ||
		DEFAULT_SUPER_ADMIN_EMAIL,
	SUPER_ADMIN_PASSWORD:
		process.env.SUPER_ADMIN_PASSWORD || DEFAULT_SUPER_ADMIN_PASSWORD,
	SUPER_ADMIN_TENANT_ID:
		process.env.SUPER_ADMIN_TENANT_ID?.trim() || DEFAULT_SUPER_ADMIN_TENANT_ID,
})

const runScript = (script: string, env: NodeJS.ProcessEnv) => {
	const result = spawnSync('node', [`dist/scripts/${script}`], {
		env,
		stdio: 'inherit',
		// note: 10m ceiling; seed-app-tenant is heavy — raise if CI flakes
		timeout: 600_000,
	})

	if (result.status !== 0) {
		if (result.error) {
			console.error(`[seed-if-empty] ${script}:`, result.error.message)
		}

		process.exit(result.status ?? 1)
	}
}

const seedIfEmpty = async () => {
	const env = seedEnv()
	const superAdminTenantId = env.SUPER_ADMIN_TENANT_ID as string

	await mongoose.connect(config.mongoDB.connectionString, {
		dbName: config.mongoDB.databaseName,
	})

	const [hasSuperAdmin, hasApp] = await Promise.all([
		Tenant.exists({ tenantId: superAdminTenantId }),
		Tenant.exists({ tenantId: APP_TENANT_ID }),
	])

	await mongoose.disconnect()

	if (hasSuperAdmin && hasApp) {
		console.log('[seed-if-empty] skip')

		return
	}

	console.log('[seed-if-empty] seeding')

	if (!hasSuperAdmin) {
		runScript('create-super-admin-user.js', env)
	}

	if (!hasApp) {
		runScript('seed-app-tenant.js', env)
	}

	console.log('[seed-if-empty] done')
	console.log(`  super admin: ${env.SUPER_ADMIN_EMAIL}`)
	console.log('  demo tenant: user@app.com / W123-456z')
}

seedIfEmpty().catch(error => {
	console.error('[seed-if-empty] failed:', error)
	process.exit(1)
})
