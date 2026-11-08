/**
 * Copy one tenant (and optionally global platform data) from Mongo into Postgres.
 * Mongo is only read. In Postgres the tenant's rows are replaced in one
 * transaction, so a rerun is safe.
 *
 *   DATABASE_URL=postgres://… npm run pg:etl -- --tenant <tenantId> [--global] [--allow-unmapped]
 *     [--models Products,Customer,...]  only these Mongoose models (and their child rows)
 *
 * Exits non-zero when a Mongo field would be dropped (unless --allow-unmapped)
 * or when a Mongo collection count differs from its Postgres table after the load.
 */
import { readdirSync } from 'fs'
import mongoose from 'mongoose'
import path from 'path'
import { eq, sql } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { config } from '../config/config'
import { createDb } from '../db/client'
import { childLinksOf, toDocs } from '../db/docs'
import { firstDiff, normalize } from '../db/etl/compare'
import { Doc, MapResult, Row, mapDocs, SPECS } from '../db/etl/mongoToPg'

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
	const onlyModels = args.includes('--models')
		? new Set(args[args.indexOf('--models') + 1].split(','))
		: undefined
	const specs = SPECS.filter(
		s =>
			(s.scope === 'tenant' || withGlobal) &&
			(!onlyModels || onlyModels.has(s.model)),
	)

	if (onlyModels && specs.length !== onlyModels.size) {
		throw new Error('unknown or non-selected model in --models')
	}

	// Child rows follow their parents: never touch children of models not loaded.
	const childLinks = specs.flatMap(spec => childLinksOf(spec.table))
	const childTables = [...new Set(childLinks.map(link => link.table))]

	await mongoose.connect(config.mongoDB.connectionString, {
		dbName: config.mongoDB.databaseName,
	})

	await loadModels()

	// Read raw documents (native driver: no Mongoose defaults, casts or hooks).
	const result: MapResult = { rows: new Map(), unmapped: new Map(), errors: [] }
	const mongoCounts = new Map<PgTable, number>()
	const mongoDocs = new Map<PgTable, Doc[]>()

	for (const spec of specs) {
		const filter = spec.scope === 'tenant' ? { tenantId } : {}
		const docs = (await mongoose
			.model(spec.model)
			.collection.find(filter)
			.toArray()) as Doc[]

		mongoCounts.set(spec.table, docs.length)
		mongoDocs.set(spec.table, docs)
		mapDocs(spec, docs, result)
	}

	// checked directly: with --models the Tenant collection may not be loaded
	if (
		!(await mongoose.model('Tenant').collection.countDocuments({ tenantId }))
	) {
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
	const touched = [...childTables, ...parents]

	await db.transaction(async tx => {
		// Children first; global tables are replaced whole, tenant tables per tenant.
		for (const table of touched) {
			const spec = specs.find(s => s.table === table)

			if (spec?.scope === 'global') {
				await tx.execute(sql`delete from ${table}`)
			} else {
				// shared child tables (party opening balances) are narrowed by party type
				const extras = childLinks
					.filter(link => link.table === table)
					.map(link => link.extra)
				const narrowed =
					extras.length && extras.every(extra => Object.keys(extra).length)
						? sql` and (${sql.join(
								extras.map(
									extra =>
										sql`(${sql.join(
											Object.entries(extra).map(
												([key, value]) =>
													sql`${sql.identifier(key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`))} = ${value}`,
											),
											sql` and `,
										)})`,
								),
								sql` or `,
							)})`
						: sql``

				await tx.execute(
					sql`delete from ${table} where tenant_id = ${tenantId}${narrowed}`,
				)
			}
		}

		for (const table of [...parents, ...childTables]) {
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

	for (const table of childTables) {
		console.log(
			`     ${tableName(table).padEnd(42)} rows ${result.rows.get(table)?.length ?? 0}`,
		)
	}

	// --verify: every Postgres row read back as a lean doc must equal its Mongo original.
	let docDiffs = 0

	if (flag('--verify')) {
		const tenantColumn = (table: PgTable) =>
			getTableConfig(table).columns.find(c => c.name === 'tenantId')!
		const children = new Map<PgTable, Row[]>()

		for (const table of childTables) {
			children.set(
				table,
				await db
					.select()
					.from(table)
					.where(eq(tenantColumn(table), tenantId)),
			)
		}

		for (const spec of specs) {
			const rows = await (spec.scope === 'tenant'
				? db
						.select()
						.from(spec.table)
						.where(eq(tenantColumn(spec.table), tenantId))
				: db.select().from(spec.table))
			const fromPg = new Map(
				toDocs(spec.table, rows, children).map(doc => [String(doc._id), doc]),
			)
			const diffs: string[] = []

			for (const original of mongoDocs.get(spec.table) ?? []) {
				const expected: Doc = { ...original }

				for (const key of ['__v', ...(spec.dropped ?? [])]) delete expected[key]

				const actual: Doc | undefined = fromPg.get(String(original._id))

				// Known, accepted differences: timestamps the upsert path never set
				// are filled from the ObjectId time; product price._id is not kept.
				// A stored empty list reads back as no field (both mean "none"; only
				// `!tenders?.length` reads it).
				if (actual) {
					for (const key of ['createdAt', 'updatedAt']) {
						if (expected[key] === undefined) delete actual[key]
					}

					for (const [key, value] of Object.entries(expected)) {
						if (Array.isArray(value) && !value.length && !(key in actual)) {
							delete expected[key]
						}
					}
				}

				if (expected.price && typeof expected.price === 'object') {
					expected.price = { ...(expected.price as Doc) }
					delete (expected.price as Doc)._id
				}

				const diff = firstDiff(normalize(expected), normalize(actual))

				if (diff) diffs.push(`_id ${String(original._id)} ${diff}`)
			}

			docDiffs += diffs.length
			console.log(
				`${diffs.length ? 'DOCS' : 'docs'} ${tableName(spec.table).padEnd(42)} ${diffs.length} of ${mongoDocs.get(spec.table)?.length ?? 0} differ`,
			)

			for (const diff of diffs.slice(0, 3)) console.log(`       ${diff}`)
		}
	}

	await pool.end()
	await mongoose.disconnect()
	if (mismatch) {
		throw new Error('row counts differ')
	}

	if (docDiffs) {
		throw new Error(`${docDiffs} documents read back differently`)
	}

	console.log('[pg-etl] done')
}

main().catch(async error => {
	console.error('[pg-etl] failed:', (error as Error).message)
	await mongoose.disconnect().catch(() => undefined)
	process.exit(1)
})
