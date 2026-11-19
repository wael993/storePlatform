import { open, stat } from 'fs/promises'
import { config } from '../../../config/config'
import { decryptSecret, encryptSecret } from '../crypto'
import { BackupError } from '../errors'
import { oauthToken, saveBody, throwResponse } from './http'
import type { BackupConnection, BackupDriver } from './index'

const LOGIN = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const GRAPH = 'https://graph.microsoft.com/v1.0'
// AppFolder: the app only sees Apps/<app name>/, never the customer's other files
const SCOPE = 'offline_access User.Read Files.ReadWrite.AppFolder'
// Graph requires chunk sizes in multiples of 320 KiB (max 60 MiB).
const CHUNK = 320 * 1024 * 32
const AUTH = 'ONEDRIVE_AUTH_ERROR'
const ACCESS = 'ONEDRIVE_ACCESS_ERROR'

const fail = (response: Response, what: string) =>
	throwResponse(
		response,
		response.status === 401 ? AUTH : ACCESS,
		`OneDrive ${what}`,
	)

const credentials = () => ({
	client_id: config.backup.oneDrive.clientId,
	client_secret: config.backup.oneDrive.clientSecret,
	scope: SCOPE,
})

/** Microsoft rotates refresh tokens: store the new one or the connection dies later. */
const accessToken = async (connection: BackupConnection): Promise<string> => {
	const tokens = await oauthToken(
		`${LOGIN}/token`,
		{
			...credentials(),
			grant_type: 'refresh_token',
			refresh_token: decryptSecret(
				connection.tenantId,
				connection.config.refreshToken,
			),
		},
		AUTH,
	)

	if (tokens.refresh_token) {
		connection.config = {
			...connection.config,
			refreshToken: encryptSecret(connection.tenantId, tokens.refresh_token),
		}

		await connection.save(connection.config)
	}

	return tokens.access_token
}

const graph = async (token: string, path: string, init: RequestInit = {}) =>
	fetch(`${GRAPH}${path}`, {
		...init,
		headers: { Authorization: `Bearer ${token}`, ...init.headers },
	})

const accountLabel = async (token: string): Promise<string> => {
	const response = await graph(token, '/me?$select=mail,userPrincipalName')

	if (!response.ok) await fail(response, 'account check')

	const me = (await response.json()) as {
		mail?: string
		userPrincipalName?: string
	}

	return me.mail ?? me.userPrincipalName ?? 'OneDrive'
}

export const oneDriveDriver: BackupDriver = {
	configured: Boolean(
		config.backup.oneDrive.clientId &&
			config.backup.oneDrive.clientSecret &&
			config.backup.oauthRedirectUri,
	),

	authorizeUrl(state) {
		return `${LOGIN}/authorize?${new URLSearchParams({
			client_id: config.backup.oneDrive.clientId,
			redirect_uri: config.backup.oauthRedirectUri,
			response_type: 'code',
			response_mode: 'query',
			scope: SCOPE,
			prompt: 'select_account',
			state,
		})}`
	},

	async connect(tenantId, code) {
		const tokens = await oauthToken(
			`${LOGIN}/token`,
			{
				...credentials(),
				grant_type: 'authorization_code',
				code,
				redirect_uri: config.backup.oauthRedirectUri,
			},
			AUTH,
		)

		if (!tokens.refresh_token) {
			throw new BackupError(AUTH, 'Microsoft returned no refresh token.')
		}

		return {
			config: { refreshToken: encryptSecret(tenantId, tokens.refresh_token) },
			accountLabel: await accountLabel(tokens.access_token),
		}
	},

	async testConnection(connection) {
		const token = await accessToken(connection)
		// approot also proves the app folder is writable
		const response = await graph(token, '/me/drive/special/approot')

		if (!response.ok) await fail(response, 'app folder check')
	},

	async upload(connection, name, filePath) {
		const token = await accessToken(connection)
		const { size } = await stat(filePath)
		const session = await graph(
			token,
			`/me/drive/special/approot:/${encodeURIComponent(name)}:/createUploadSession`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					item: { '@microsoft.graph.conflictBehavior': 'rename' },
				}),
			},
		)

		if (!session.ok) await fail(session, 'upload start')

		const { uploadUrl } = (await session.json()) as { uploadUrl: string }
		const handle = await open(filePath, 'r')

		try {
			// size 0 is impossible: an archive always has header + tag
			for (let start = 0; start < size; start += CHUNK) {
				const length = Math.min(CHUNK, size - start)
				const chunk = Buffer.alloc(length)

				await handle.read(chunk, 0, length, start)

				// uploadUrl is pre-authorized: no Authorization header
				const response = await fetch(uploadUrl, {
					method: 'PUT',
					headers: {
						'Content-Length': String(length),
						'Content-Range': `bytes ${start}-${start + length - 1}/${size}`,
					},
					body: chunk,
				})

				if (!response.ok) {
					await fetch(uploadUrl, { method: 'DELETE' }).catch(() => undefined)
					await fail(response, 'upload')
				}

				if (start + length >= size) {
					const item = (await response.json()) as { id: string; size: number }

					return { storageId: item.id, size: item.size }
				}
			}
		} finally {
			await handle.close()
		}

		throw new BackupError('UPLOAD_ERROR', 'OneDrive upload did not finish.')
	},

	async download(connection, storageId, filePath) {
		// /content answers with a redirect to a pre-authenticated URL; fetch follows it
		const response = await graph(
			await accessToken(connection),
			`/me/drive/items/${encodeURIComponent(storageId)}/content`,
		)

		if (!response.ok || !response.body) await fail(response, 'download')

		await saveBody(response, filePath)
	},

	async remove(connection, storageId) {
		const response = await graph(
			await accessToken(connection),
			`/me/drive/items/${encodeURIComponent(storageId)}`,
			{ method: 'DELETE' },
		)

		if (!response.ok && response.status !== 404) await fail(response, 'delete')
	},
}
