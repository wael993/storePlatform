import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from 'vitest'
import { decryptSecret, encryptSecret } from '../shared/backup/crypto'
import { dropboxDriver } from '../shared/backup/drivers/dropbox'
import { googleDriveDriver } from '../shared/backup/drivers/googleDrive'
import type { BackupConnection } from '../shared/backup/drivers/index'
import { oneDriveDriver } from '../shared/backup/drivers/oneDrive'

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	})

let dir = ''

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'backup-drivers-'))
})

afterAll(() => rm(dir, { recursive: true, force: true }))
afterEach(() => vi.unstubAllGlobals())

const connection = (): BackupConnection & { saved: unknown[] } => {
	const saved: unknown[] = []

	return {
		tenantId: 'tenant-a',
		config: { refreshToken: encryptSecret('tenant-a', 'old-refresh') },
		save: async config => {
			saved.push(config)
		},
		saved,
	}
}

describe('Google Drive driver', () => {
	it('takes id and size from the upload answer, no extra lookup', async () => {
		const file = join(dir, 'g.backup')

		await writeFile(file, Buffer.alloc(1234, 2))

		const urls: string[] = []

		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				urls.push(url)

				if (url.endsWith('/token')) return json({ access_token: 'access' })

				if (url.includes('uploadType=resumable')) {
					return new Response(null, {
						status: 200,
						headers: { Location: 'https://upload.example/g' },
					})
				}

				return json({ id: 'file-1', size: '1234' })
			}),
		)

		expect(
			await googleDriveDriver.upload(connection(), 'x.backup', file),
		).toEqual({
			storageId: 'file-1',
			size: 1234,
		})

		expect(urls.find(url => url.includes('uploadType'))).toContain(
			'fields=id,size',
		)

		expect(urls).toHaveLength(3) // token, session, upload
	})

	it('fails clearly when Drive answers without a size', async () => {
		const file = join(dir, 'g2.backup')

		await writeFile(file, Buffer.alloc(10, 2))
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) =>
				url.endsWith('/token')
					? json({ access_token: 'access' })
					: url.includes('uploadType=resumable')
						? new Response(null, {
								headers: { Location: 'https://upload.example/g' },
							})
						: json({ id: 'file-1' }),
			),
		)

		await expect(
			googleDriveDriver.upload(connection(), 'x.backup', file),
		).rejects.toMatchObject({ code: 'UPLOAD_ERROR' })
	})
})

describe('decryptSecret', () => {
	it('reports a truncated or foreign secret as ENCRYPTION_ERROR', () => {
		expect(() => decryptSecret('tenant-a', 'v1:AAAA')).toThrow(
			expect.objectContaining({ code: 'ENCRYPTION_ERROR' }),
		)

		expect(() =>
			decryptSecret('tenant-b', encryptSecret('tenant-a', 'secret')),
		).toThrow(expect.objectContaining({ code: 'ENCRYPTION_ERROR' }))
	})
})

describe('OneDrive driver', () => {
	it('uploads in 320 KiB-aligned chunks and stores the rotated refresh token', async () => {
		const chunk = 320 * 1024 * 32
		const size = chunk + 100
		const file = join(dir, 'big.backup')

		await writeFile(file, Buffer.alloc(size, 1))

		const ranges: string[] = []
		const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
			if (url.endsWith('/token')) {
				return json({ access_token: 'access', refresh_token: 'new-refresh' })
			}

			if (url.includes('createUploadSession')) {
				return json({ uploadUrl: 'https://upload.example/session' })
			}

			const range = (init?.headers as Record<string, string>)['Content-Range']

			ranges.push(range)

			return range.endsWith(`-${size - 1}/${size}`)
				? json({ id: 'item-1', size }, 201)
				: json({}, 202)
		})

		vi.stubGlobal('fetch', fetchMock)

		const conn = connection()
		const result = await oneDriveDriver.upload(conn, 'café_2026.backup', file)

		expect(result).toEqual({ storageId: 'item-1', size })
		expect(ranges).toEqual([
			`bytes 0-${chunk - 1}/${size}`,
			`bytes ${chunk}-${size - 1}/${size}`,
		])

		expect(conn.saved).toHaveLength(1)
		expect(
			decryptSecret(
				'tenant-a',
				(conn.saved[0] as { refreshToken: string }).refreshToken,
			),
		).toBe('new-refresh')
	})

	it('treats a missing item on delete as success', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) =>
				url.endsWith('/token') ? json({ access_token: 'a' }) : json({}, 404),
			),
		)

		await expect(
			oneDriveDriver.remove(connection(), 'gone'),
		).resolves.toBeUndefined()
	})
})

describe('Dropbox driver', () => {
	it('escapes non-ASCII names in the Dropbox-API-Arg header', async () => {
		const file = join(dir, 'small.backup')

		await writeFile(file, Buffer.alloc(64, 2))

		let arg = ''

		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string, init?: RequestInit) => {
				if (url.endsWith('/token')) return json({ access_token: 'a' })

				arg = (init?.headers as Record<string, string>)['Dropbox-API-Arg']

				return json({ id: 'id:abc', size: 64 })
			}),
		)

		const result = await dropboxDriver.upload(
			connection(),
			'متجر_2026.backup',
			file,
		)

		expect(result).toEqual({ storageId: 'id:abc', size: 64 })
		expect(/^[\x20-\x7e]+$/.test(arg)).toBe(true)
		expect(JSON.parse(arg).path).toBe('/متجر_2026.backup')
	})

	it('maps a revoked token to DROPBOX_AUTH_ERROR', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => json({ error: 'invalid_grant' }, 400)),
		)

		await expect(
			dropboxDriver.testConnection(connection()),
		).rejects.toMatchObject({
			code: 'DROPBOX_AUTH_ERROR',
		})
	})
})
