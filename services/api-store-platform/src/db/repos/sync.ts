import { isNull, sql } from 'drizzle-orm'
import { Types } from 'mongoose'

import { Executor, getDb, requireTenantId } from '..'
import { syncMutations } from '../schema'

/**
 * Offline sync: record a processed client mutation (replays are answered from it).
 * Upsert by clientMutationId, like `findOneAndUpdate(..., { upsert: true })`.
 */
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
		// DB clock, like the backup's snapshotAt it is compared with on restore
		processedAt: sql`now()`,
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
			// a success stays: a parallel retry that lost the race must not record it as failed
			setWhere: isNull(syncMutations.result),
		})
}
