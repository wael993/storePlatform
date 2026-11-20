import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
	BACKUP_FORMAT_VERSION,
	decryptArchive,
	parseRowLine,
	readArchive,
	rowLine,
	writeArchive,
} from '../shared/backup/archive'
import { decryptSecret, encryptSecret } from '../shared/backup/crypto'
import { validateArchive } from '../shared/backup/engine'
import { BACKUP_SCHEMA_FINGERPRINT } from '../shared/backup/tables'

let dir = ''

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'backup-test-'))
})

afterAll(() => rm(dir, { recursive: true, force: true }))

const manifest = (over: Record<string, unknown> = {}) => ({
	backupVersion: BACKUP_FORMAT_VERSION,
	schemaFingerprint: BACKUP_SCHEMA_FINGERPRINT,
	tenantId: 'tenant-a',
	...over,
})

// exact digits JS numbers cannot hold; a tab and a newline escaped inside the JSON text
const ROW =
	'{"id":"p1","tenant_id":"tenant-a","retail_price":89940.1199999999998745,"name":"منتج\\t\\n"}'

const lines = async function* (
	head = manifest(),
	rows: string[] = [rowLine('products', ROW)],
) {
	yield `${JSON.stringify(head)}\n`
	yield* rows
}

const archive = async (name: string, ...args: Parameters<typeof lines>) => {
	const enc = join(dir, `${name}.enc`)
	const plain = join(dir, `${name}.plain`)

	await writeArchive('tenant-a', lines(...args), enc)
	await decryptArchive('tenant-a', enc, plain)

	return { enc, plain }
}

describe('backup archive', () => {
	it('round-trips row text unchanged through gzip + AES-GCM', async () => {
		const { plain } = await archive('a')
		const out: string[] = []

		for await (const line of readArchive(plain)) out.push(line)

		expect(out).toHaveLength(2)
		expect(JSON.parse(out[0])).toMatchObject({ tenantId: 'tenant-a' })
		expect(parseRowLine(out[1])).toEqual({ table: 'products', json: ROW })
	})

	it('passes restore validation for its own tenant only', async () => {
		const { plain } = await archive('v')

		await expect(validateArchive('tenant-a', plain)).resolves.toMatchObject({
			tenantId: 'tenant-a',
		})

		await expect(validateArchive('tenant-b', plain)).rejects.toMatchObject({
			code: 'TENANT_VALIDATION_ERROR',
		})
	})

	it.each([
		[
			'a foreign row',
			manifest(),
			[rowLine('products', '{"tenant_id":"tenant-b"}')],
			'TENANT_VALIDATION_ERROR',
		],
		[
			'an unknown table',
			manifest(),
			[rowLine('users', '{"tenant_id":"tenant-a"}')],
			'RESTORE_VALIDATION_ERROR',
		],
		[
			'an excluded table',
			manifest(),
			[rowLine('sync_mutations', '{"tenant_id":"tenant-a"}')],
			'RESTORE_VALIDATION_ERROR',
		],
		[
			'another database structure',
			manifest({ schemaFingerprint: 'old' }),
			[],
			'RESTORE_VALIDATION_ERROR',
		],
		[
			'another format version',
			manifest({ backupVersion: 1 }),
			[],
			'RESTORE_VALIDATION_ERROR',
		],
	])('refuses %s', async (name, head, rows, code) => {
		const { plain } = await archive(name.replace(/\s/g, '-'), head, rows)

		await expect(validateArchive('tenant-a', plain)).rejects.toMatchObject({
			code,
		})
	})

	it('rejects another tenant decrypting the archive', async () => {
		const { enc } = await archive('b')

		await expect(
			decryptArchive('tenant-b', enc, join(dir, 'b2.plain')),
		).rejects.toMatchObject({ code: 'RESTORE_VALIDATION_ERROR' })
	})

	it('rejects a tampered archive', async () => {
		const { enc } = await archive('c')
		const bytes = await readFile(enc)

		bytes[30] ^= 0xff
		await writeFile(enc, bytes)
		await expect(
			decryptArchive('tenant-a', enc, join(dir, 'c2.plain')),
		).rejects.toMatchObject({ code: 'RESTORE_VALIDATION_ERROR' })
	})

	it('encrypts provider secrets per tenant', () => {
		const stored = encryptSecret('tenant-a', 'refresh-token')

		expect(stored).not.toContain('refresh-token')
		expect(decryptSecret('tenant-a', stored)).toBe('refresh-token')
		expect(() => decryptSecret('tenant-b', stored)).toThrow()
	})
})
