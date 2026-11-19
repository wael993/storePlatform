/**
 * Applies pending Postgres migrations (drizzle/). Runs before the server starts
 * (docker-entrypoint.sh); drizzle-kit is a dev dependency and not in the image.
 */
import path from 'path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

import { createDb } from '../db/client'

const main = async () => {
	const { db, pool } = createDb()

	await migrate(db, {
		migrationsFolder: path.join(__dirname, '../../drizzle'),
	})

	await pool.end()
	console.log('[db-migrate] done')
}

main().catch(error => {
	console.error('[db-migrate] failed:', (error as Error).message)
	process.exit(1)
})
