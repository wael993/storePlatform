import { randomUUID } from 'crypto'
import { appendFile, copyFile, mkdtemp, readdir, rm, stat, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { closeDb, getDb } from '../db'
import {
	acquireRestoreLock,
	BACKUP_KIND,
	BACKUP_STATUS,
	bumpDataVersion,
	claimNextBackupJob,
	consumeOAuthNonce,
	dueBackupTenants,
	enqueueBackupJob,
	failStaleBackupJobs,
	getBackupJob,
	getBackupState,
	releaseRestoreLock,
	RestoreState,
	updateBackupState,
} from '../db/repos/backups'
import {
	invoiceItems,
	invoices,
	products,
	tenantBackups,
	tenantBackupStates,
	tenants,
} from '../db/schema'
import { decryptArchive, readArchive, rowLine } from '../shared/backup/archive'
import {
	applyArchive,
	applyRetention,
	beginRestore,
	enqueueBackup,
	processBackup,
	restoreBackup,
	validateArchive,
	writeTenantArchive,
} from '../shared/backup/engine'
import { BACKUP_TABLES } from '../shared/backup/tables'

const enabled = Boolean(process.env.DATABASE_URL)

// In-memory provider: files live in a temp folder; `failUploads` simulates a provider outage.
const storage = vi.hoisted(() => ({
	dir: '',
	failUploads: false,
	onUpload: undefined as undefined | (() => Promise<unknown>),
}))

vi.mock('../shared/backup/drivers', () => {
	const driver = {
		configured: true,
		authorizeUrl: () => '',
		connect: async () => ({ config: {}, accountLabel: 'test' }),
		testConnection: async () => undefined,
		upload: async (_: unknown, name: string, file: string) => {
			if (storage.failUploads) throw new Error('provider down')

			await storage.onUpload?.()

			const storageId = `${randomUUID()}-${name}`

			await copyFile(file, join(storage.dir, storageId))

			return { storageId, size: (await stat(file)).size }
		},
		download: async (_: unknown, storageId: string, file: string) =>
			copyFile(join(storage.dir, storageId), file),
		remove: async (_: unknown, storageId: string) =>
			unlink(join(storage.dir, storageId)).catch(() => undefined),
	}

	return {
		BACKUP_PROVIDERS: ['memory'],
		isBackupProvider: (value: unknown) => value === 'memory',
		getDriver: () => driver,
	}
})

const created: string[] = []

const seedTenant = async (name: string) => {
	const tenantId = `bk-${randomUUID()}`
	const db = getDb()

	created.push(tenantId)
	await db.insert(tenants).values({
		id: randomUUID(),
		tenantId,
		name,
		domain: `${tenantId}.test`,
		status: 'active',
		accessiblePages: ['BACKUP'],
	})

	await db.insert(products).values([
		{
			id: `${tenantId}-p1`,
			tenantId,
			productId: 'p1',
			name: 'منتج "quoted"\ttab\nline',
			retailPrice: '89940.1199999999998745', // more digits than a JS number holds
			priceCurrency: 'USD',
			attributes: { color: 'rot', sizes: [1, 2] },
			images: ['a.png', 'b.png'],
		},
		{
			id: `${tenantId}-p2`,
			tenantId,
			productId: 'p2',
			name: 'Second',
			retailPrice: '0.10',
			priceCurrency: 'SYP',
		},
	])

	await db.insert(invoices).values({
		id: `${tenantId}-i1`,
		tenantId,
		invoiceId: 'i1',
		invoiceNumber: 'SI-000001',
		issuedAt: new Date('2026-11-19T10:15:30.123Z'),
	})

	await db.insert(invoiceItems).values([1, 2].map(position => ({
		invoiceRowId: `${tenantId}-i1`,
		tenantId,
		position,
		productId: `p${position}`,
		name: `line ${position}`,
		quantity: '1.333333333333333333',
		unitPrice: '2.5',
	})))

	await updateBackupState(tenantId, {
		enabled: true,
		provider: 'memory',
		connections: {
			memory: { config: {}, accountLabel: 'test', connectedAt: new Date().toISOString() },
		},
	})

	return tenantId
}

/** Every backed-up row of a tenant as Postgres' own JSON text: equal means identical data. */
const snapshot = async (tenantId: string) => {
	const out: Record<string, string[]> = {}

	for (const { name } of BACKUP_TABLES) {
		const { rows } = await getDb().execute<{ json: string }>(sql`
			select row_to_json(t)::text as json
			from ${sql.identifier('store')}.${sql.identifier(name)} t
			where t.tenant_id = ${tenantId} order by 1`)

		if (rows.length) out[name] = rows.map(row => row.json)
	}

	return out
}

/** The kind of change a user makes after a backup: edit, delete (cascading lines), add. */
const changeData = async (tenantId: string) => {
	const db = getDb()

	await db.update(products).set({ retailPrice: '1' }).where(eq(products.id, `${tenantId}-p1`))
	await db.delete(invoices).where(eq(invoices.id, `${tenantId}-i1`))
	await db.insert(products).values({
		id: `${tenantId}-p3`,
		tenantId,
		productId: 'p3',
		name: 'Added after the backup',
		retailPrice: '5',
		priceCurrency: 'USD',
	})
}

const backupNow = async (tenantId: string) => {
	const job = await enqueueBackup(tenantId, 'Test', 'memory', BACKUP_KIND.MANUAL, BACKUP_STATUS.PROCESSING)

	expect(await processBackup(job)).toBe(BACKUP_STATUS.COMPLETED)

	return (await getBackupJob(job.id))!
}

const restoreNow = async (tenantId: string, backupId: string) => {
	const run = await beginRestore(tenantId, backupId)

	expect(run).not.toBeNull()
	await restoreBackup(tenantId, (await getBackupJob(backupId))!, 'memory', run!)

	return (await getBackupState(tenantId))?.restore as RestoreState
}

describe.skipIf(!enabled)('tenant backup and restore (Postgres)', () => {
	let a = ''
	let b = ''

	beforeAll(async () => {
		storage.dir = await mkdtemp(join(tmpdir(), 'backup-store-'))
		a = await seedTenant('Tenant A')
		b = await seedTenant('Tenant B')
	})

	afterAll(async () => {
		const db = getDb()

		for (const { name } of [...BACKUP_TABLES].reverse()) {
			await db.execute(sql`delete from ${sql.identifier('store')}.${sql.identifier(name)}
				where tenant_id = any(${sql.param(created)})`)
		}

		await db.delete(tenantBackups).where(inArray(tenantBackups.tenantId, created))
		await db.delete(tenantBackupStates).where(inArray(tenantBackupStates.tenantId, created))
		await db.delete(tenants).where(inArray(tenants.tenantId, created))
		await rm(storage.dir, { recursive: true, force: true })
		await closeDb()
	})

	it('restores a tenant exactly as backed up and leaves other tenants alone', async () => {
		await bumpDataVersion(a)
		expect((await dueBackupTenants()).map(due => due.tenantId)).toContain(a)

		const before = await snapshot(a)
		const otherBefore = await snapshot(b)
		const backup = await backupNow(a)

		expect(backup.status).toBe(BACKUP_STATUS.COMPLETED)
		// nothing changed since: not due again
		expect((await dueBackupTenants()).map(due => due.tenantId)).not.toContain(a)

		await changeData(a)
		expect(await snapshot(a)).not.toEqual(before)

		const restore = await restoreNow(a, backup.id)

		expect(restore).toMatchObject({ status: 'COMPLETED', backupId: backup.id })
		expect(await snapshot(a)).toEqual(before)
		expect(await snapshot(b)).toEqual(otherBefore)

		const [p1] = await getDb().execute<{ price: string }>(
			sql`select retail_price::text as price from store.products where id = ${`${a}-p1`}`,
		).then(result => result.rows)

		expect(p1.price).toBe('89940.1199999999998745')

		// the safety backup holds the state just before the restore
		expect((await getBackupJob(restore.safetyBackupId!))?.status).toBe(BACKUP_STATUS.COMPLETED)
		// lock released; restored data is due for the next scheduled backup
		expect((await getDb().select().from(tenants).where(eq(tenants.tenantId, a)))[0].backupRestoreStartedAt).toBeNull()
		expect((await dueBackupTenants()).map(due => due.tenantId)).toContain(a)
	})

	it('rolls everything back when the restore fails half-way', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'backup-fail-'))
		const enc = join(dir, 'enc')
		const plain = join(dir, 'plain')

		await writeTenantArchive(a, 'Tenant A', enc)
		await decryptArchive(a, enc, plain)
		// passes validation (right tenant, known table) but breaks NOT NULL on insert
		await appendFile(plain, rowLine('products', JSON.stringify({ id: `${a}-bad`, tenant_id: a })))
		await validateArchive(a, plain)

		await changeData(a).catch(() => undefined) // p3 may already exist from the test above
		const current = await snapshot(a)

		await expect(applyArchive(a, plain, new Date())).rejects.toThrow()
		expect(await snapshot(a)).toEqual(current)
		await rm(dir, { recursive: true, force: true })
	})

	it('aborts the restore when the safety backup fails, data untouched', async () => {
		const backup = await backupNow(a)

		await getDb().update(products).set({ retailPrice: '7' }).where(eq(products.id, `${a}-p2`))
		const current = await snapshot(a)

		storage.failUploads = true
		const restore = await restoreNow(a, backup.id).finally(() => {
			storage.failUploads = false
		})

		expect(restore).toMatchObject({ status: 'FAILED', errorCode: 'SAFETY_BACKUP_FAILED' })
		expect(await snapshot(a)).toEqual(current)
		const lock = await acquireRestoreLock(a) // released after the failure

		expect(lock).not.toBeNull()
		await releaseRestoreLock(a, lock!)
	})

	it('keeps only the newest N backups, files included', async () => {
		await getDb().update(tenants).set({ backupRetentionCount: 1 }).where(eq(tenants.tenantId, b))
		await backupNow(b)
		const newest = await backupNow(b)
		const completed = await getDb()
			.select({ id: tenantBackups.id, storageId: tenantBackups.storageId })
			.from(tenantBackups)
			.where(eq(tenantBackups.tenantId, b))

		expect(completed).toEqual([{ id: newest.id, storageId: newest.storageId }])
		expect((await readdir(storage.dir)).filter(file => file === newest.storageId)).toHaveLength(1)
	})

	it('keeps the backup being restored even when the safety backup fills the retention window', async () => {
		await getDb().update(tenants).set({ backupRetentionCount: 1 }).where(eq(tenants.tenantId, a))
		const backup = await backupNow(a)
		const restore = await restoreNow(a, backup.id)

		expect(restore.status).toBe('COMPLETED')
		expect((await getBackupJob(backup.id))?.status).toBe(BACKUP_STATUS.COMPLETED)
		expect(await readdir(storage.dir)).toContain(backup.storageId)
		await getDb().update(tenants).set({ backupRetentionCount: null }).where(eq(tenants.tenantId, a))
	})

	it('skips retention while a restore runs; the next run catches up', async () => {
		await getDb().update(tenants).set({ backupRetentionCount: 1 }).where(eq(tenants.tenantId, a))
		const old = await backupNow(a)
		let lockedAt: Date | null = null

		// the job passed the restore check, then a restore starts during its upload
		storage.onUpload = async () => {
			lockedAt = await acquireRestoreLock(a)
		}

		await backupNow(a).finally(() => (storage.onUpload = undefined))

		expect(lockedAt).not.toBeNull()
		expect(await readdir(storage.dir)).toContain(old.storageId)

		await releaseRestoreLock(a, lockedAt!)
		await applyRetention(a)
		expect(await readdir(storage.dir)).not.toContain(old.storageId)
		await getDb().update(tenants).set({ backupRetentionCount: null }).where(eq(tenants.tenantId, a))
	})

	it('ranks safety backups apart, so restores never push regular backups out', async () => {
		await getDb().update(tenants).set({ backupRetentionCount: 1 }).where(eq(tenants.tenantId, a))
		const regular = await backupNow(a)

		expect((await restoreNow(a, regular.id)).status).toBe('COMPLETED')
		const kept = await backupNow(a)
		const completed = await getDb()
			.select({ id: tenantBackups.id, kind: tenantBackups.kind })
			.from(tenantBackups)
			.where(and(eq(tenantBackups.tenantId, a), eq(tenantBackups.status, BACKUP_STATUS.COMPLETED)))

		// newest regular + newest safety; the older regular one is gone
		expect(completed.filter(row => row.kind !== BACKUP_KIND.SAFETY)).toEqual([
			{ id: kept.id, kind: BACKUP_KIND.MANUAL },
		])

		expect(completed.filter(row => row.kind === BACKUP_KIND.SAFETY)).toHaveLength(1)
		await getDb().update(tenants).set({ backupRetentionCount: null }).where(eq(tenants.tenantId, a))
	})

	it('never completes a job that was failed as stale; drops its uploaded file', async () => {
		const job = await enqueueBackup(b, 'Test', 'memory', BACKUP_KIND.SAFETY, BACKUP_STATUS.PROCESSING)
		const filesBefore = await readdir(storage.dir)

		// a newer job completed meanwhile: the late failure must not overwrite that status
		await updateBackupState(b, { lastBackupStatus: 'COMPLETED' })

		// while the upload hangs, another instance's failStaleBackupJobs fails the row
		storage.onUpload = () =>
			getDb()
				.update(tenantBackups)
				.set({ status: BACKUP_STATUS.FAILED, errorCode: 'WORKER_TIMEOUT' })
				.where(eq(tenantBackups.id, job.id))

		expect(await processBackup(job).finally(() => (storage.onUpload = undefined))).toBe(
			BACKUP_STATUS.FAILED,
		)

		expect(await getBackupJob(job.id)).toMatchObject({ status: BACKUP_STATUS.FAILED, storageId: null })
		expect(await readdir(storage.dir)).toEqual(filesBefore)
		expect((await getBackupState(b))?.lastBackupStatus).toBe('COMPLETED')
	})

	it('fails a job whose worker stopped beating, not one that still beats', async () => {
		const job = await enqueueBackup(b, 'Test', 'memory', BACKUP_KIND.SAFETY, BACKUP_STATUS.PROCESSING)

		await failStaleBackupJobs()
		expect((await getBackupJob(job.id))?.status).toBe(BACKUP_STATUS.PROCESSING)

		// last heartbeat 6 minutes ago: the process died (e.g. a deploy)
		await getDb()
			.update(tenantBackups)
			.set({ updatedAt: new Date(Date.now() - 6 * 60_000) })
			.where(eq(tenantBackups.id, job.id))

		await failStaleBackupJobs()
		expect(await getBackupJob(job.id)).toMatchObject({
			status: BACKUP_STATUS.FAILED,
			errorCode: 'WORKER_TIMEOUT',
		})
	})

	it('frees a restore lock without heartbeat; the old restore can neither commit nor release', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'backup-lock-'))
		const plain = join(dir, 'plain')

		await writeTenantArchive(b, 'Tenant B', join(dir, 'enc'))
		await decryptArchive(b, join(dir, 'enc'), plain)

		const oldLock = (await acquireRestoreLock(b))!

		// the old restore's process died: no heartbeat for 6 minutes
		await getDb()
			.update(tenants)
			.set({ backupRestoreHeartbeatAt: new Date(Date.now() - 6 * 60_000) })
			.where(eq(tenants.tenantId, b))

		await getDb().update(products).set({ retailPrice: '3' }).where(eq(products.id, `${b}-p2`))
		const current = await snapshot(b) // written after the lock went stale

		const newLock = await acquireRestoreLock(b)

		expect(newLock).not.toBeNull()
		await expect(applyArchive(b, plain, oldLock)).rejects.toMatchObject({ code: 'RESTORE_ERROR' })
		expect(await snapshot(b)).toEqual(current)

		await releaseRestoreLock(b, oldLock) // must not free the new restore's lock
		expect(await acquireRestoreLock(b)).toBeNull()
		await releaseRestoreLock(b, newLock!)
		await rm(dir, { recursive: true, force: true })
	})

	it('does not queue scheduled backups while a restore runs', async () => {
		await bumpDataVersion(b)
		const lock = (await acquireRestoreLock(b))!

		expect((await dueBackupTenants()).map(due => due.tenantId)).not.toContain(b)
		await releaseRestoreLock(b, lock)
		expect((await dueBackupTenants()).map(due => due.tenantId)).toContain(b)
	})

	it('accepts an OAuth nonce once, and only the latest one', async () => {
		await updateBackupState(b, { oauthNonce: 'old' })
		await updateBackupState(b, { oauthNonce: 'new' })

		expect(await consumeOAuthNonce(b, 'old')).toBe(false)
		expect(await consumeOAuthNonce(a, 'new')).toBe(false) // other tenant
		expect(await consumeOAuthNonce(b, 'new')).toBe(true)
		expect(await consumeOAuthNonce(b, 'new')).toBe(false) // replay
	})

	it('reads tables larger than one cursor page completely', async () => {
		const tenantId = await seedTenant('Big')

		await getDb().execute(sql`
			insert into store.products (id, tenant_id, product_id, name, retail_price, price_currency)
			select ${tenantId} || '-g' || g, ${tenantId}, 'g' || g, 'bulk', 1, 'USD'
			from generate_series(1, 2500) g`)

		const dir = await mkdtemp(join(tmpdir(), 'backup-big-'))

		await writeTenantArchive(tenantId, 'Big', join(dir, 'enc'))
		await decryptArchive(tenantId, join(dir, 'enc'), join(dir, 'plain'))

		let products = 0

		for await (const line of readArchive(join(dir, 'plain'))) {
			if (line.startsWith('products\t')) products++
		}

		expect(products).toBe(2502) // 2 seeded + 2,500
		await rm(dir, { recursive: true, force: true })
	})

	it('allows one restore at a time per tenant', async () => {
		const lockB = (await acquireRestoreLock(b))!

		expect(lockB).not.toBeNull()
		expect(await acquireRestoreLock(b)).toBeNull()
		const lockA = (await acquireRestoreLock(a))! // other tenants are not blocked

		expect(lockA).not.toBeNull()
		await releaseRestoreLock(a, lockA)
		await releaseRestoreLock(b, lockB)
		const again = await acquireRestoreLock(b)

		expect(again).not.toBeNull()
		await releaseRestoreLock(b, again!)
	})

	it('queues one job per tenant and hands each job to one worker only', async () => {
		const job = (kind: typeof BACKUP_KIND.MANUAL | typeof BACKUP_KIND.SCHEDULED) =>
			enqueueBackupJob({ id: randomUUID(), tenantId: b, name: 'x', provider: 'memory', kind, status: BACKUP_STATUS.PENDING })
		const first = await job(BACKUP_KIND.MANUAL)

		expect((await job(BACKUP_KIND.SCHEDULED)).id).toBe(first.id) // deduped while in flight

		// drain the queue with two workers at a time; this job must be claimed exactly once
		const claimed: string[] = []

		for (;;) {
			const pair = await Promise.all([claimNextBackupJob(), claimNextBackupJob()])

			claimed.push(...pair.filter(Boolean).map(j => j!.id))

			if (pair.some(j => !j)) break
		}

		expect(claimed.filter(id => id === first.id)).toHaveLength(1)
		expect(new Set(claimed).size).toBe(claimed.length)
		await getDb().update(tenantBackups).set({ status: BACKUP_STATUS.FAILED }).where(eq(tenantBackups.id, first.id))
	})
})
