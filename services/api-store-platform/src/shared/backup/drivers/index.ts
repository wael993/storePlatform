import { BackupError } from '../errors'
import { dropboxDriver } from './dropbox'
import { googleDriveDriver } from './googleDrive'
import { oneDriveDriver } from './oneDrive'

export type BackupConnection = {
	tenantId: string
	/** The driver's own stored config (encrypted secrets inside). */
	config: Record<string, unknown>
	/** Persist a changed config, e.g. a rotated refresh token. */
	save: (config: Record<string, unknown>) => Promise<void>
}

/**
 * Everything provider-specific lives behind this interface. The engine, worker,
 * retention and restore only ever call `getDriver(provider)`.
 */
export interface BackupDriver {
	/** App credentials present in env; unconfigured providers are not offered for connecting. */
	configured: boolean
	/** Provider consent URL; `state` must come back unchanged to the OAuth callback. */
	authorizeUrl(state: string): string
	/** Exchanges the OAuth code, verifies access, returns config to store. */
	connect(
		tenantId: string,
		code: string,
	): Promise<{ config: Record<string, unknown>; accountLabel: string }>
	testConnection(connection: BackupConnection): Promise<void>
	upload(
		connection: BackupConnection,
		name: string,
		filePath: string,
	): Promise<{ storageId: string; size: number }>
	download(
		connection: BackupConnection,
		storageId: string,
		filePath: string,
	): Promise<void>
	/** Must succeed when the file is already gone. */
	remove(connection: BackupConnection, storageId: string): Promise<void>
}

const DRIVERS: Record<string, BackupDriver> = {
	google_drive: googleDriveDriver,
	dropbox: dropboxDriver,
	onedrive: oneDriveDriver,
}

/** Providers a tenant can connect now. Old backups stay restorable via getDriver either way. */
export const BACKUP_PROVIDERS = Object.keys(DRIVERS).filter(
	provider => DRIVERS[provider].configured,
)

export const isBackupProvider = (value: unknown): value is string =>
	typeof value === 'string' &&
	Object.prototype.hasOwnProperty.call(DRIVERS, value)

export const getDriver = (provider: string): BackupDriver => {
	if (!isBackupProvider(provider)) {
		throw new BackupError(
			'PROVIDER_NOT_SUPPORTED',
			`Unknown provider ${provider}`,
		)
	}

	return DRIVERS[provider]
}
