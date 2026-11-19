import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import jwt from 'jsonwebtoken'

import { config } from '../../config/config'
import { getDb } from '../../db'
import {
	BACKUP_KIND,
	BackupJob,
	BackupState,
	Connections,
	consumeOAuthNonce,
	findCompletedBackup,
	getBackupState,
	listBackupJobs,
	RestoreState,
	setProviderConnection,
	updateBackupState,
} from '../../db/repos/backups'
import { tenants } from '../../db/schema'
import {
	AuthorizationError,
	BusinessLogicError,
} from '../../middleware/errorHandler'
import {
	DEFAULT_BACKUP_RETENTION,
	isRestoreLockLive,
} from '../../shared/backup/constants'
import {
	BACKUP_PROVIDERS,
	getDriver,
	isBackupProvider,
} from '../../shared/backup/drivers'
import {
	beginRestore,
	enqueueBackup,
	getConnection,
	restoreBackup,
} from '../../shared/backup/engine'
import { backupErrorCode } from '../../shared/backup/errors'
import { ERROR_CODES } from '../../shared/errorCodes'
import logger from '../../shared/logger/logger'
import { RequestContext } from '../../shared/types'

const OAUTH_AUDIENCE = 'backup-oauth'
const HISTORY_LIMIT = 50

type OAuthState = { tenantId: string; provider: string; nonce: string }

const mapBackup = (backup: BackupJob) => ({
	backupId: backup.id,
	name: backup.name,
	provider: backup.provider,
	kind: backup.kind,
	status: backup.status,
	size: backup.size ?? null,
	createdAt: backup.createdAt,
	completedAt: backup.completedAt ?? null,
	// code only: technical messages stay in logs / the record
	errorCode: backup.errorCode ?? null,
})

const connectionsOf = (state: BackupState | null): Connections =>
	(state?.connections as Connections | undefined) ?? {}

export default class BackupController {
	private requireOwner(requestContext: RequestContext): string {
		if (requestContext.role !== 'owner' || !requestContext.tenantId) {
			throw new AuthorizationError(
				ERROR_CODES.AUTHORIZATION.FORBIDDEN,
				'Only the owner can manage backups.',
			)
		}

		if (!config.backup.masterKey) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.BACKUP_NOT_CONFIGURED,
				'Backups are not available on this server.',
			)
		}

		return requestContext.tenantId
	}

	private async testProvider(tenantId: string, provider: string) {
		try {
			await getDriver(provider).testConnection(
				await getConnection(tenantId, provider),
			)
		} catch (error) {
			logger.warn(
				`Backup provider test failed for ${tenantId}/${provider}: ${error}`,
			)

			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.BACKUP_PROVIDER_ERROR,
				'The storage provider could not be reached. Reconnect it and try again.',
				backupErrorCode(error, 'PROVIDER_ERROR'),
			)
		}
	}

	public async getSettings(requestContext: RequestContext) {
		const tenantId = this.requireOwner(requestContext)
		const [state, [tenant]] = await Promise.all([
			getBackupState(tenantId),
			getDb()
				.select({
					backupRetentionCount: tenants.backupRetentionCount,
					restoreHeartbeatAt: tenants.backupRestoreHeartbeatAt,
				})
				.from(tenants)
				.where(eq(tenants.tenantId, tenantId)),
		])
		const restore = state?.restore as RestoreState | null | undefined
		// RUNNING without a live lock: the process died or the run hit its cap (it rolls back)
		const restoreCrashed =
			restore?.status === 'RUNNING' &&
			!isRestoreLockLive(tenant?.restoreHeartbeatAt)

		return {
			enabled: state?.enabled ?? false,
			provider: state?.provider ?? null,
			providers: BACKUP_PROVIDERS,
			connections: Object.entries(connectionsOf(state)).map(
				([provider, connection]) => ({
					provider,
					accountLabel: connection.accountLabel,
					connectedAt: connection.connectedAt,
				}),
			),
			retentionCount:
				tenant?.backupRetentionCount ?? DEFAULT_BACKUP_RETENTION,
			schedule: config.backup.schedule,
			timezone: config.cron.timezone,
			lastBackupAt: state?.lastBackupAt ?? null,
			lastBackupStatus: state?.lastBackupStatus ?? null,
			restore: restore
				? {
						...restore,
						status: restoreCrashed ? 'FAILED' : restore.status,
						errorCode: restoreCrashed
							? 'RESTORE_ERROR'
							: (restore.errorCode ?? null),
					}
				: null,
		}
	}

	/** `provider` switches to an already connected provider (tested first); `enabled` toggles schedules. */
	public async updateSettings(
		body: { enabled?: unknown; provider?: unknown },
		requestContext: RequestContext,
	) {
		const tenantId = this.requireOwner(requestContext)
		const updates: { enabled?: boolean; provider?: string } = {}

		if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
				'enabled must be a boolean.',
			)
		}

		if (body.provider !== undefined) {
			if (!isBackupProvider(body.provider)) {
				throw new BusinessLogicError(
					ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
					'Unknown backup provider.',
				)
			}

			await this.testProvider(tenantId, body.provider)
			updates.provider = body.provider
		}

		if (body.enabled === true && !updates.provider) {
			const provider = (await getBackupState(tenantId))?.provider

			if (!provider) {
				throw new BusinessLogicError(
					ERROR_CODES.BUSINESS_LOGIC.BACKUP_NOT_CONFIGURED,
					'Connect a storage provider before enabling backups.',
				)
			}

			// a dead connection would only fail later, at the scheduled run
			await this.testProvider(tenantId, provider)
		}

		if (typeof body.enabled === 'boolean') updates.enabled = body.enabled

		await updateBackupState(tenantId, updates)

		return this.getSettings(requestContext)
	}

	public async startConnect(provider: string, requestContext: RequestContext) {
		const tenantId = this.requireOwner(requestContext)

		if (!BACKUP_PROVIDERS.includes(provider)) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
				'Unknown backup provider.',
			)
		}

		// one pending connect per tenant: a newer one or the callback invalidates it
		const nonce = randomUUID()

		await updateBackupState(tenantId, { oauthNonce: nonce })

		const state = jwt.sign(
			{ tenantId, provider, nonce } satisfies OAuthState,
			config.jwtSecret,
			{
				audience: OAUTH_AUDIENCE,
				expiresIn: '10m',
			},
		)

		return { url: getDriver(provider).authorizeUrl(state) }
	}

	/**
	 * OAuth redirect target (no bearer token: the browser comes back from the provider).
	 * The signed `state` carries the tenant; a connected provider becomes the active one,
	 * since `connect` already proved access. Returns where to send the browser.
	 */
	public async completeConnect(
		query: Record<string, unknown>,
	): Promise<string> {
		const back = (result: string) =>
			`${config.backup.frontendReturnUrl}?backup=${result}`

		try {
			const { tenantId, provider, nonce } = jwt.verify(
				String(query.state ?? ''),
				config.jwtSecret,
				{
					audience: OAUTH_AUDIENCE,
				},
			) as OAuthState

			// consumed before the code exchange: a copied or replayed `state` is refused
			if (
				typeof nonce !== 'string' ||
				!(await consumeOAuthNonce(tenantId, nonce))
			) {
				logger.warn(`Backup OAuth callback: unknown or used state (${tenantId})`)

				return back('error')
			}

			if (typeof query.code !== 'string' || !isBackupProvider(provider)) {
				return back('cancelled')
			}

			const { config: providerConfig, accountLabel } = await getDriver(
				provider,
			).connect(tenantId, query.code)

			await setProviderConnection(
				tenantId,
				provider,
				{
					config: providerConfig,
					accountLabel,
					connectedAt: new Date().toISOString(),
				},
				{ provider },
			)

			return back('connected')
		} catch (error) {
			logger.error(`Backup OAuth callback failed: ${error}`)

			return back('error')
		}
	}

	/** Removes stored credentials. Backups on that provider stay listed but can't be restored until reconnected. */
	public async disconnect(provider: string, requestContext: RequestContext) {
		const tenantId = this.requireOwner(requestContext)

		if (!isBackupProvider(provider)) {
			throw new BusinessLogicError(
				ERROR_CODES.VALIDATION.FIELD_IN_NOT_VALID_FORMAT,
				'Unknown backup provider.',
			)
		}

		const isActive = (await getBackupState(tenantId))?.provider === provider

		await setProviderConnection(
			tenantId,
			provider,
			null,
			isActive ? { provider: null, enabled: false } : {},
		)

		return this.getSettings(requestContext)
	}

	public async listBackups(requestContext: RequestContext) {
		const tenantId = this.requireOwner(requestContext)

		return (await listBackupJobs(tenantId, HISTORY_LIMIT)).map(mapBackup)
	}

	/** Manual "Backup now": same queue + worker as scheduled runs; dedupes an in-flight job. */
	public async runBackup(requestContext: RequestContext) {
		const tenantId = this.requireOwner(requestContext)
		const state = await getBackupState(tenantId)

		if (!state?.enabled || !state.provider) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.BACKUP_NOT_CONFIGURED,
				'Enable backups and connect a storage provider first.',
			)
		}

		await this.testProvider(tenantId, state.provider)

		return mapBackup(
			await enqueueBackup(
				tenantId,
				requestContext.tenantName ?? tenantId,
				state.provider,
				BACKUP_KIND.MANUAL,
			),
		)
	}

	/** Starts a restore in the background; progress is read from getSettings().restore. */
	public async restore(backupId: string, requestContext: RequestContext) {
		const tenantId = this.requireOwner(requestContext)
		const [backup, state] = await Promise.all([
			findCompletedBackup(tenantId, backupId),
			getBackupState(tenantId),
		])

		if (!backup) {
			throw new BusinessLogicError(
				ERROR_CODES.DOCUMENTS.DOCUMENT_READ_ERROR,
				'Backup not found.',
			)
		}

		if (!state?.provider || !connectionsOf(state)[backup.provider]) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.BACKUP_NOT_CONFIGURED,
				'Connect the provider of this backup and an active provider (for the safety backup) first.',
			)
		}

		await this.testProvider(tenantId, state.provider)

		// RUNNING is stored before the 202, so the client's next read already sees it
		const run = await beginRestore(tenantId, backupId)

		if (!run) {
			throw new BusinessLogicError(
				ERROR_CODES.BUSINESS_LOGIC.BACKUP_RESTORE_IN_PROGRESS,
				'A restore is already running.',
			)
		}

		void restoreBackup(tenantId, backup, state.provider, run).catch(error =>
			logger.error(`Restore ${backupId} crashed: ${error}`),
		)

		return { status: 'RUNNING', backupId }
	}
}
