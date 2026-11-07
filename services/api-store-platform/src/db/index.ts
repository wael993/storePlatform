import { createDb, Db } from './client'

let instance: ReturnType<typeof createDb> | undefined

/** Process-wide Postgres client, created on first use (fails closed without DATABASE_URL). */
export const getDb = (): Db => {
	instance ??= createDb()

	return instance.db
}

export const closeDb = async () => {
	await instance?.pool.end()
	instance = undefined
}

export type DbTx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Anything that can run a query: the client or an open transaction. */
export type Executor = Db | DbTx

/** Runs `work` in the caller's transaction, or opens one. */
export const inTransaction = <T>(
	tx: DbTx | undefined,
	work: (tx: DbTx) => Promise<T>,
): Promise<T> => (tx ? work(tx) : getDb().transaction(work))

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
