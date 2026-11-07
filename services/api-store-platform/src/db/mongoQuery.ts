import { and, or, sql, SQL } from 'drizzle-orm'
import { AnyPgColumn, getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { Model } from 'mongoose'

import { DbTx, Executor, getDb, inTransaction, requireTenantId } from '.'
import { deleteDocs, findDocs, specForModel } from './docs'
import { Doc } from './etl/mongoToPg'
import * as t from './schema'

/**
 * Mongo filter / sort / projection / simple update → SQL, with Mongo's
 * semantics, so ported call sites keep their filter objects unchanged:
 * `Inventory.find(filter)` → `pgFind(Inventory, tenantId, filter)`.
 * Anything not listed here throws; nothing is guessed.
 *
 * Semantics kept: `{f: null}` and `$exists: false` match missing (NULL);
 * `$ne` / `$nin` also match missing; ascending sort puts missing first,
 * descending last; `{arrayField: x}` matches an element; dotted paths into
 * `createdBy`/`updatedBy` and into child arrays (`items.productId`) work.
 *
 * Limit: a field stored as null and a missing field are both NULL here, so
 * `$exists: true` = IS NOT NULL (Mongo would also match a stored null). Every
 * current use is on fields that are set or absent, never stored as null.
 */

type Filter = Record<string, unknown>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = Model<any>

const AUDIT_PATHS: Record<string, string> = {
	'createdBy._id': 'createdById',
	'createdBy.displayName': 'createdByName',
	'createdBy.role': 'createdByRole',
	'createdBy.createdAt': 'createdByAt',
	'updatedBy._id': 'updatedById',
	'updatedBy.displayName': 'updatedByName',
	'updatedBy.role': 'updatedByRole',
	'updatedBy.updatedAt': 'updatedByAt',
}

/** Array fields stored as child tables: parent table → field → child table + link. */
const CHILD_FIELDS = new Map<
	PgTable,
	Record<string, { table: PgTable; link: string; parentKey: string }>
>([
	[
		t.invoices,
		{
			items: { table: t.invoiceItems, link: 'invoiceRowId', parentKey: 'id' },
			currencyAmounts: {
				table: t.invoiceCurrencyAmounts,
				link: 'invoiceRowId',
				parentKey: 'id',
			},
			tenders: {
				table: t.invoiceTenders,
				link: 'invoiceRowId',
				parentKey: 'id',
			},
		},
	],
	[
		t.buyingInvoices,
		{
			items: {
				table: t.buyingInvoiceItems,
				link: 'buyingInvoiceRowId',
				parentKey: 'id',
			},
			currencyAmounts: {
				table: t.buyingInvoiceCurrencyAmounts,
				link: 'buyingInvoiceRowId',
				parentKey: 'id',
			},
			tenders: {
				table: t.buyingInvoiceTenders,
				link: 'buyingInvoiceRowId',
				parentKey: 'id',
			},
		},
	],
	[
		t.employees,
		{
			salaries: {
				table: t.employeeSalaries,
				link: 'employeeId',
				parentKey: 'employeeId',
			},
			payouts: {
				table: t.employeePayouts,
				link: 'employeeId',
				parentKey: 'employeeId',
			},
		},
	],
])

const columnOf = (table: PgTable, name: string) =>
	getTableConfig(table).columns.find(c => c.name === name)

const unsupported = (what: string): never => {
	throw new Error(`mongoQuery: unsupported ${what}`)
}

const resolve = (
	table: PgTable,
	path: string,
): {
	column: AnyPgColumn
	child?: { table: PgTable; link: string; parentKey: string }
} => {
	const name = path === '_id' ? 'id' : (AUDIT_PATHS[path] ?? path)
	const direct = columnOf(table, name)

	if (direct) return { column: direct as AnyPgColumn }

	const [head, ...rest] = path.split('.')
	const child = CHILD_FIELDS.get(table)?.[head]
	const childColumn =
		child && rest.length === 1 ? columnOf(child.table, rest[0]) : undefined

	if (child && childColumn) return { column: childColumn as AnyPgColumn, child }

	return unsupported(`field "${path}" on ${getTableConfig(table).name}`)
}

const isOperatorObject = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) &&
	typeof value === 'object' &&
	!Array.isArray(value) &&
	!(value instanceof Date) &&
	Object.keys(value as object).every(key => key.startsWith('$'))

const valueList = (value: unknown) =>
	Array.isArray(value) ? value : unsupported('$in/$nin without array')

/** One field condition on a plain (scalar or array) column. */
const fieldCondition = (column: AnyPgColumn, condition: unknown): SQL => {
	const isArray = column.columnType === 'PgArray'
	const equals = (value: unknown): SQL =>
		value === null || value === undefined
			? sql`${column} is null`
			: isArray
				? sql`${value} = any(${column})`
				: sql`${column} = ${value}`
	const inList = (values: unknown[]): SQL => {
		const present = values.filter(v => v !== null && v !== undefined)
		const parts: SQL[] = []

		if (present.length) {
			parts.push(
				isArray
					? sql`${column} && array[${sql.join(
							present.map(v => sql`${v}`),
							sql`, `,
						)}]::text[]`
					: sql`${column} in (${sql.join(
							present.map(v => sql`${v}`),
							sql`, `,
						)})`,
			)
		}

		if (present.length !== values.length) parts.push(sql`${column} is null`)

		return parts.length ? or(...parts)! : sql`false`
	}

	if (!isOperatorObject(condition)) return equals(condition)

	const parts = Object.entries(condition).map(([op, value]): SQL => {
		switch (op) {
			case '$eq':
				return equals(value)
			case '$ne':
				return value === null ? sql`${column} is not null` : not(equals(value))
			case '$in':
				return inList(valueList(value))
			case '$nin':
				return not(inList(valueList(value)))
			case '$gt':
				return sql`${column} > ${value}`
			case '$gte':
				return sql`${column} >= ${value}`
			case '$lt':
				return sql`${column} < ${value}`
			case '$lte':
				return sql`${column} <= ${value}`
			case '$exists':
				return value ? sql`${column} is not null` : sql`${column} is null`
			case '$regex': {
				const options = String(condition.$options ?? '')
				const source = value instanceof RegExp ? value.source : String(value)

				return options.includes('i') ||
					(value instanceof RegExp && value.flags.includes('i'))
					? sql`${column} ~* ${source}`
					: sql`${column} ~ ${source}`
			}
			case '$options':
				return sql`true`

			default:
				return unsupported(`operator ${op}`)
		}
	})

	return and(...parts)!
}

// `not(equals)` must also match NULL, like Mongo's $ne / $nin on a missing field.
const not = (condition: SQL): SQL => sql`(${condition}) is not true`

export const whereOf = (table: PgTable, filter: Filter = {}): SQL => {
	const parts: SQL[] = []

	for (const [key, value] of Object.entries(filter)) {
		if (value === undefined) continue

		if (key === '$or' || key === '$and' || key === '$nor') {
			const branches = (value as Filter[]).map(branch => whereOf(table, branch))

			parts.push(
				key === '$and'
					? and(...branches)!
					: key === '$or'
						? or(...branches)!
						: not(or(...branches)!),
			)

			continue
		}

		if (key.startsWith('$')) unsupported(`top-level ${key}`)

		const { column, child } = resolve(table, key)

		if (!child) {
			parts.push(fieldCondition(column, value))

			continue
		}

		const parent = columnOf(table, child.parentKey)!
		const link = columnOf(child.table, child.link)!

		parts.push(
			sql`exists (select 1 from ${child.table} where ${link} = ${parent} and ${fieldCondition(column, value)})`,
		)
	}

	return parts.length ? and(...parts)! : sql`true`
}

export const orderOf = (
	table: PgTable,
	sort: Record<string, unknown> = {},
): SQL[] => {
	const order = Object.entries(sort).map(([path, direction]) => {
		const { column, child } = resolve(table, path)

		if (child) unsupported(`sort on child field ${path}`)

		const descending =
			direction === -1 || direction === 'desc' || direction === 'descending'

		return descending
			? sql`${column} desc nulls last`
			: sql`${column} asc nulls first`
	})

	// insertion order (Mongo natural order) breaks ties
	return [...order, sql`${columnOf(table, 'id')} asc`]
}

/** `.select()` projection: 'a b' / '-a' / { a: 1 } / { a: 0 }. */
const project = (
	docs: Doc[],
	select?: string | Record<string, unknown>,
): Doc[] => {
	if (!select) return docs

	const entries =
		typeof select === 'string'
			? select
					.split(/\s+/)
					.filter(Boolean)
					.map(field =>
						field.startsWith('-') ? [field.slice(1), 0] : [field, 1],
					)
			: Object.entries(select)
	const include = entries
		.filter(([, flag]) => flag && flag !== 0)
		.map(([field]) => String(field))
	const exclude = new Set(
		entries.filter(([, flag]) => !flag).map(([field]) => String(field)),
	)

	return docs.map(doc => {
		if (include.length) {
			const picked: Doc = {}

			for (const field of include) {
				const [head] = field.split('.')

				if (doc[head] !== undefined) picked[head] = doc[head]
			}

			if (!exclude.has('_id')) picked._id = doc._id

			return picked
		}

		const copy = { ...doc }

		for (const field of exclude) delete copy[field]

		return copy
	})
}

export type FindOptions = {
	select?: string | Record<string, unknown>
	sort?: Record<string, unknown>
	limit?: number
	skip?: number
	db?: Executor
	lock?: boolean
}

const tableOf = (model: AnyModel) => specForModel(model).table

/** Lean documents; `T` defaults to the loose typing `.lean()` call sites had. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pgFind = async <T = any>(
	model: AnyModel,
	tenantId: string | undefined,
	filter: Filter = {},
	options: FindOptions = {},
): Promise<T[]> => {
	const table = tableOf(model)
	const docs = await findDocs(table, tenantId, {
		where: whereOf(table, filter),
		order: orderOf(table, options.sort),
		limit: options.limit,
		offset: options.skip,
		db: options.db,
		lock: options.lock,
	})

	return project(docs, options.select) as T[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pgFindOne = async <T = any>(
	model: AnyModel,
	tenantId: string | undefined,
	filter: Filter = {},
	options: FindOptions = {},
): Promise<T | null> =>
	(await pgFind<T>(model, tenantId, filter, { ...options, limit: 1 }))[0] ??
	null

export const pgCount = async (
	model: AnyModel,
	tenantId: string | undefined,
	filter: Filter = {},
	db: Executor = getDb(),
): Promise<number> => {
	const table = tableOf(model)
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(table)
		.where(
			and(
				sql`${columnOf(table, 'tenantId')} = ${requireTenantId(tenantId)}`,
				whereOf(table, filter),
			),
		)

	return count
}

export const pgDistinct = async (
	model: AnyModel,
	tenantId: string | undefined,
	field: string,
	filter: Filter = {},
): Promise<unknown[]> => {
	const values = new Set<unknown>()

	for (const doc of await pgFind(model, tenantId, filter, { select: field })) {
		const value = doc[field]

		for (const item of Array.isArray(value) ? value : [value]) {
			if (item !== undefined && item !== null) values.add(item)
		}
	}

	return [...values]
}

export const pgDeleteMany = async (
	model: AnyModel,
	tenantId: string | undefined,
	filter: Filter,
	tx?: DbTx,
): Promise<{ deletedCount: number }> => {
	const table = tableOf(model)
	const deleted = await deleteDocs(table, tenantId, whereOf(table, filter), tx)

	return { deletedCount: deleted.length }
}

/** `updateMany(filter, { $set, $inc, $unset })` on plain columns; child arrays / nested paths throw. */
export const pgUpdateMany = async (
	model: AnyModel,
	tenantId: string | undefined,
	filter: Filter,
	update: Record<string, unknown>,
	tx?: DbTx,
): Promise<{ matchedCount: number; modifiedCount: number }> => {
	const table = tableOf(model)
	const set: Record<string, unknown> = { updatedAt: new Date() }

	for (const [op, fields] of Object.entries(update)) {
		for (const [path, value] of Object.entries(
			fields as Record<string, unknown>,
		)) {
			const { column, child } = resolve(table, path)

			if (child) unsupported(`update of child field ${path}`)

			const key = column.name
			const asValue = (v: unknown) =>
				column.columnType === 'PgNumeric' && typeof v === 'number'
					? String(v)
					: v

			if (op === '$set') set[key] = asValue(value)
			else if (op === '$unset') set[key] = null
			else if (op === '$inc')
				set[key] = sql`coalesce(${column}, 0) + ${String(value)}::numeric`
			else unsupported(`update operator ${op}`)
		}
	}

	return inTransaction(tx, async db => {
		const rows = await db
			.update(table)
			.set(set as never)
			.where(
				and(
					sql`${columnOf(table, 'tenantId')} = ${requireTenantId(tenantId)}`,
					whereOf(table, filter),
				),
			)
			.returning({ id: columnOf(table, 'id')! })

		return { matchedCount: rows.length, modifiedCount: rows.length }
	})
}
