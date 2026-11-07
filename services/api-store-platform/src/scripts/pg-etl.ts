/**
 * Copy one tenant (and optionally global platform data) from Mongo into Postgres.
 * Mongo is only read. In Postgres the tenant's rows are replaced in one
 * transaction, so a rerun is safe.
 *
 *   DATABASE_URL=postgres://… npm run pg:etl -- --tenant <tenantId> [--global] [--allow-unmapped]
 *
 * Exits non-zero when a Mongo field would be dropped (unless --allow-unmapped)
 * or when a Mongo collection count differs from its Postgres table after the load.
 */
import { readdirSync } from 'fs'
import mongoose from 'mongoose'
import path from 'path'
import { sql } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { config } from '../config/config'
import { createDb } from '../db/client'
import {
	CHILD_TABLES,
	Doc,
	MapResult,
	mapDocs,
	SPECS,
} from '../db/etl/mongoToPg'

const CHUNK = 500

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const tenantId = args[args.indexOf('--tenant') + 1]

const tableName = (table: PgTable) => {
	const { schema, name } = getTableConfig(table)

	return `${schema}.${name}`
}

const loadModels = async () => {
	const dir = path.join(__dirname, '../models')

	for (const file of readdirSync(dir)) {
		await import(path.join(dir, file))
	}
}

const main = async () => {
	if (!args.includes('--tenant') || !tenantId || tenantId.startsWith('--')) {
		throw new Error(
			'usage: pg-etl --tenant <tenantId> [--global] [--allow-unmapped]',
		)
	}

	const withGlobal = flag('--global')
	const specs = SPECS.filter(s => s.scope === 'tenant' || withGlobal)

	await mongoose.connect(config.mongoDB.connectionString, {
		dbName: config.mongoDB.databaseName,
	})

	await loadModels()

	// Read raw documents (native driver: no Mongoose defaults, casts or hooks).
	const result: MapResult = { rows: new Map(), unmapped: new Map(), errors: [] }
	const mongoCounts = new Map<PgTable, number>()

	for (const spec of specs) {
		const filter = spec.scope === 'tenant' ? { tenantId } : {}
		const docs = (await mongoose
			.model(spec.model)
			.collection.find(filter)
			.toArray()) as Doc[]

		mongoCounts.set(spec.table, docs.length)
		mapDocs(spec, docs, result)
	}

	if (!mongoCounts.get(SPECS[0].table)) {
		throw new Error(`tenant ${tenantId} not found in Mongo`)
	}

	if (result.errors.length) {
		console.error('[pg-etl] documents that cannot be loaded as they are:')
		for (const error of result.errors) {
			console.error(`  ${error}`)
		}

		throw new Error('fix these documents in Mongo first (nothing was written)')
	}

	if (result.unmapped.size) {
		console.error('[pg-etl] Mongo fields with no Postgres column:')
		for (const [field, count] of [...result.unmapped].sort()) {
			console.error(`  ${field}  (${count} docs)`)
		}

		if (!flag('--allow-unmapped')) {
			throw new Error(
				'unmapped fields: add columns or confirm with --allow-unmapped',
			)
		}
	}

	const { db, pool } = createDb()

	console.log(`[pg-etl] target ${new URL(process.env.DATABASE_URL!).host}`)
	const parents = specs.map(s => s.table)
	const touched = [...CHILD_TABLES, ...parents]

	await db.transaction(async tx => {
		// Children first; global tables are replaced whole, tenant tables per tenant.
		for (const table of touched) {
			const spec = specs.find(s => s.table === table)

			if (spec?.scope === 'global') {
				await tx.execute(sql`delete from ${table}`)
			} else {
				await tx.execute(
					sql`delete from ${table} where tenant_id = ${tenantId}`,
				)
			}
		}

		for (const table of [...parents, ...CHILD_TABLES]) {
			const rows = result.rows.get(table) ?? []

			for (let i = 0; i < rows.length; i += CHUNK) {
				await tx.insert(table).values(rows.slice(i, i + CHUNK) as never)
			}
		}
	})

	let mismatch = false

	for (const spec of specs) {
		const where =
			spec.scope === 'tenant' ? sql`where tenant_id = ${tenantId}` : sql``
		const { rows } = await db.execute<{ count: string }>(
			sql`select count(*) from ${spec.table} ${where}`,
		)
		const pg = Number(rows[0].count)
		const mongo = mongoCounts.get(spec.table) ?? 0
		const ok = pg === mongo

		mismatch ||= !ok
		console.log(
			`${ok ? 'ok  ' : 'DIFF'} ${tableName(spec.table).padEnd(42)} mongo ${mongo}  pg ${pg}`,
		)
	}

	for (const table of CHILD_TABLES) {
		console.log(
			`     ${tableName(table).padEnd(42)} rows ${result.rows.get(table)?.length ?? 0}`,
		)
	}

	await pool.end()
	await mongoose.disconnect()
	if (mismatch) {
		throw new Error('row counts differ')
	}

	console.log('[pg-etl] done')
}

main().catch(async error => {
	console.error('[pg-etl] failed:', (error as Error).message)
	await mongoose.disconnect().catch(() => undefined)
	process.exit(1)
})
