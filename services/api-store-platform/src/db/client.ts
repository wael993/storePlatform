import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

/** Fails closed: no DATABASE_URL, no client. */
export const createDb = (url = process.env.DATABASE_URL) => {
	if (!url) {
		throw new Error('DATABASE_URL is not set')
	}

	const pool = new Pool({ connectionString: url, max: 10 })

	return { db: drizzle({ client: pool, schema, casing: 'snake_case' }), pool }
}

export type Db = ReturnType<typeof createDb>['db']
