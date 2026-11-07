import { and, eq, gte, SQL } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { Types } from 'mongoose'

import { Executor, getDb, requireTenantId } from '..'
import { findDoc, findDocs } from '../docs'
import { Doc } from '../etl/mongoToPg'
import { syncMutations } from '../schema'

/** Postgres versions of the offline-sync helpers in `api.controller.ts`. */

export const getProcessedSyncMutation = (
	tenantId: string,
	clientMutationId: string,
	db?: Executor,
) =>
	findDoc(
		syncMutations,
		tenantId,
		eq(syncMutations.clientMutationId, clientMutationId),
		db,
	) as Promise<{ result?: Record<string, unknown>; error?: string } | null>

/** Upsert by clientMutationId, like `findOneAndUpdate(..., { upsert: true })`. */
export const recordSyncMutation = async (
	tenantId: string,
	mutation: {
		clientMutationId: string
		entity: string
		operation: string
		result?: Record<string, unknown>
		error?: string
	},
	db: Executor = getDb(),
) => {
	const values = {
		entity: mutation.entity,
		operation: mutation.operation,
		result: mutation.result ?? null,
		error: mutation.error ?? null,
		processedAt: new Date(),
		updatedAt: new Date(),
	}

	await db
		.insert(syncMutations)
		.values({
			id: new Types.ObjectId().toHexString(),
			tenantId: requireTenantId(tenantId),
			clientMutationId: mutation.clientMutationId,
			...values,
		})
		.onConflictDoUpdate({
			target: [syncMutations.tenantId, syncMutations.clientMutationId],
			set: values,
		})
}

/** `getDocumentsSince`: tenant docs with updatedAt >= since (+ an extra condition). */
export const documentsSince = (
	table: PgTable,
	tenantId: string,
	since: Date,
	extra?: SQL,
	db?: Executor,
): Promise<Doc[]> => {
	const updatedAt = getTableConfig(table).columns.find(
		column => column.name === 'updatedAt',
	)

	if (!updatedAt) {
		throw new Error(`${getTableConfig(table).name} has no updatedAt`)
	}

	return findDocs(table, tenantId, {
		where: and(gte(updatedAt, since), extra),
		db,
	})
}
