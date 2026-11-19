import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto'
import { config } from '../../config/config'
import { BackupError } from './errors'

type KeyPurpose = 'archive' | 'provider-secret'

/** Per-tenant AES-256 key derived from the server master key; never stored anywhere. */
export const tenantKey = (tenantId: string, purpose: KeyPurpose): Buffer => {
	const master = Buffer.from(config.backup.masterKey, 'base64')

	if (master.length !== 32) {
		throw new BackupError(
			'ENCRYPTION_ERROR',
			'BACKUP_MASTER_KEY must be base64 of 32 bytes.',
		)
	}

	return Buffer.from(
		hkdfSync(
			'sha256',
			master,
			tenantId,
			`store-platform-backup:${purpose}:v1`,
			32,
		),
	)
}

/** Encrypts small provider secrets (refresh tokens) for storage. */
export const encryptSecret = (tenantId: string, plaintext: string): string => {
	const iv = randomBytes(12)
	const cipher = createCipheriv(
		'aes-256-gcm',
		tenantKey(tenantId, 'provider-secret'),
		iv,
	)
	const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])

	return `v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`
}

export const decryptSecret = (tenantId: string, stored: unknown): string => {
	if (typeof stored !== 'string' || !stored.startsWith('v1:')) {
		throw new BackupError('ENCRYPTION_ERROR', 'Stored secret is not readable.')
	}

	const raw = Buffer.from(stored.slice(3), 'base64')
	const key = tenantKey(tenantId, 'provider-secret')

	try {
		const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))

		decipher.setAuthTag(raw.subarray(12, 28))

		return Buffer.concat([
			decipher.update(raw.subarray(28)),
			decipher.final(),
		]).toString('utf8')
	} catch (error) {
		// truncated value or another BACKUP_MASTER_KEY: reconnecting the provider fixes it
		throw new BackupError(
			'ENCRYPTION_ERROR',
			`Stored secret cannot be decrypted: ${String(error)}`,
		)
	}
}
