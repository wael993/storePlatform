import { sql, SQLWrapper } from 'drizzle-orm'

import { createDb, Db } from './client'

/**
 * `column = any($1)` with all values in ONE array parameter. `IN (...)` / `inArray`
 * send one parameter per value, and Postgres refuses more than 65,535.
 */
export const anyOf = (column: SQLWrapper, values: unknown[]) =>
	sql`${column} = any(${sql.param(values)})`

let instance: ReturnType<typeof createDb> | undefined
let txInstance: ReturnType<typeof createDb> | undefined

/** Process-wide Postgres client, created on first use (fails closed without DATABASE_URL). */
export const getDb = (): Db => {
	instance ??= createDb()

	return instance.db
}

/**
 * Transactions get their own pool: a read inside a transaction that misses
 * `db: tx` takes a connection from getDb()'s pool, which no transaction holds,
 * so N open transactions can never starve each other.
 */
const getTxDb = (): Db => {
	txInstance ??= createDb()

	return txInstance.db
}

export const closeDb = async () => {
	await Promise.all([instance?.pool.end(), txInstance?.pool.end()])
	instance = undefined
	txInstance = undefined
}

export type DbTx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Anything that can run a query: the client or an open transaction. */
export type Executor = Db | DbTx

/** Deadlock / serialization failure: safe to run the whole transaction again. */
const RETRYABLE = new Set(['40P01', '40001'])
const MAX_ATTEMPTS = 3

const pgErrorCode = (error: unknown): string | undefined => {
	const { code, cause } = (error ?? {}) as { code?: string; cause?: unknown }

	return code ?? (cause as { code?: string } | undefined)?.code
}

/**
 * Runs `work` in the caller's transaction, or opens one. An own transaction is
 * retried on deadlock / serialization failure, like Mongo's withTransaction
 * retried transient errors (callbacks must stay re-runnable, as they had to be).
 */
export const inTransaction = async <T>(
	tx: DbTx | undefined,
	work: (tx: DbTx) => Promise<T>,
): Promise<T> => {
	if (tx) return work(tx)

	for (let attempt = 1; ; attempt++) {
		try {
			return await getTxDb().transaction(work)
		} catch (error) {
			if (attempt >= MAX_ATTEMPTS || !RETRYABLE.has(pgErrorCode(error) ?? '')) {
				throw error
			}
		}
	}
}

/** Postgres unique violation (23505), possibly wrapped by Drizzle. Was Mongo's 11000. */
export const isUniqueViolation = (error: unknown) =>
	pgErrorCode(error) === '23505'

/**
 * Deliberate "no tenant filter" for global lookups: a tenant by its domain, a
 * refresh token by its hash, platform tables (roles, newsroom, payment settings).
 * A missing tenant id still fails closed; only this marker opts out.
 */
export const ALL_TENANTS = Symbol('all tenants')
export type TenantScope = string | typeof ALL_TENANTS | undefined

/** Same message as the Mongo tenant plugin: every store query needs a tenant. */
export const requireTenantId = (tenantId: string | undefined): string => {
	if (!tenantId) {
		throw new Error('Tenant-scoped query is missing tenant context.')
	}

	return tenantId
}

export type AuditActor = {
	_id: string
	displayName: string
	role?: string
	createdAt?: Date
}

/** `createdBy` subdocument → audit columns. */
export const createdByColumns = (actor: AuditActor) => ({
	createdById: actor._id,
	createdByName: actor.displayName,
	createdByRole: actor.role,
	createdByAt: actor.createdAt ?? new Date(),
})

/** Audit columns → the `createdBy` shape the API returns. */
export const createdByOf = (row: {
	createdById: string | null
	createdByName: string | null
	createdByRole: string | null
}) => ({
	_id: row.createdById ?? '',
	displayName: row.createdByName ?? '',
	role: row.createdByRole ?? undefined,
})

/** numeric column (string) → number, keeping null/undefined. */
export const num = (value: string | null | undefined): number | undefined =>
	value === null || value === undefined ? undefined : Number(value)
