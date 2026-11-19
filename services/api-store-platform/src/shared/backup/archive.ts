import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { open, stat } from 'fs/promises'
import { createInterface } from 'readline'
import { Readable } from 'stream'
import { finished, pipeline } from 'stream/promises'
import { createGunzip, createGzip } from 'zlib'

import { tenantKey } from './crypto'
import { BackupError } from './errors'

/**
 * File layout: MAGIC(4) | FORMAT(1) | IV(12) | AES-256-GCM(gzip(lines)) | TAG(16).
 * Lines: the manifest as JSON, then one `<table>\t<row as JSON>` per row. Row JSON is
 * Postgres' own `row_to_json` text and goes back through `json_populate_recordset`
 * untouched, so numeric, timestamps and jsonb never pass through JavaScript numbers.
 */
const MAGIC = Buffer.from('SPBK')
const FORMAT = 2
const HEADER_LENGTH = MAGIC.length + 1 + 12
const TAG_LENGTH = 16

export const BACKUP_FORMAT_VERSION = 2

export type BackupManifest = {
	backupVersion: number
	schemaFingerprint: string
	tenantId: string
	tenantName: string
	createdAt: string
	applicationVersion: string
	dataVersion: number
	tables: string[]
}

export type BackupRow = { table: string; json: string }

export const rowLine = (table: string, json: string) => `${table}\t${json}\n`

export const parseRowLine = (line: string): BackupRow => {
	const tab = line.indexOf('\t')

	if (tab <= 0) {
		throw new BackupError('RESTORE_VALIDATION_ERROR', 'Malformed backup line.')
	}

	return { table: line.slice(0, tab), json: line.slice(tab + 1) }
}

/** Streams lines → gzip → AES-256-GCM into `filePath`; nothing is held in memory. */
export const writeArchive = async (
	tenantId: string,
	lines: AsyncIterable<string>,
	filePath: string,
): Promise<void> => {
	const iv = randomBytes(12)
	const cipher = createCipheriv(
		'aes-256-gcm',
		tenantKey(tenantId, 'archive'),
		iv,
	)
	const out = createWriteStream(filePath)

	out.write(Buffer.concat([MAGIC, Buffer.from([FORMAT]), iv]))

	await pipeline(Readable.from(lines), createGzip(), cipher, out, {
		end: false,
	})

	out.end(cipher.getAuthTag())
	await finished(out)
}

/**
 * Decrypts and decompresses to a plain text file. Rejects (and the caller must
 * discard `plainPath`) when the auth tag fails: wrong tenant, wrong key or tampering.
 */
export const decryptArchive = async (
	tenantId: string,
	encryptedPath: string,
	plainPath: string,
): Promise<void> => {
	const { size } = await stat(encryptedPath)

	if (size < HEADER_LENGTH + TAG_LENGTH) {
		throw new BackupError(
			'RESTORE_VALIDATION_ERROR',
			'Backup file is too small.',
		)
	}

	const handle = await open(encryptedPath, 'r')
	const header = Buffer.alloc(HEADER_LENGTH)
	const tag = Buffer.alloc(TAG_LENGTH)

	try {
		await handle.read(header, 0, HEADER_LENGTH, 0)
		await handle.read(tag, 0, TAG_LENGTH, size - TAG_LENGTH)
	} finally {
		await handle.close()
	}

	if (!header.subarray(0, 4).equals(MAGIC) || header[4] !== FORMAT) {
		throw new BackupError(
			'RESTORE_VALIDATION_ERROR',
			'Not a store-platform backup or unsupported format.',
		)
	}

	const decipher = createDecipheriv(
		'aes-256-gcm',
		tenantKey(tenantId, 'archive'),
		header.subarray(5),
	)

	decipher.setAuthTag(tag)

	try {
		await pipeline(
			createReadStream(encryptedPath, {
				start: HEADER_LENGTH,
				end: size - TAG_LENGTH - 1,
			}),
			decipher,
			createGunzip(),
			createWriteStream(plainPath),
		)
	} catch (error) {
		throw new BackupError(
			'RESTORE_VALIDATION_ERROR',
			`Backup decryption/integrity check failed: ${String(error)}`,
		)
	}
}

/** Lines of a decrypted archive (manifest first). */
export async function* readArchive(
	plainPath: string,
): AsyncGenerator<string> {
	const lines = createInterface({
		input: createReadStream(plainPath, 'utf8'),
		crlfDelay: Infinity,
	})

	for await (const line of lines) {
		if (line) yield line
	}
}
