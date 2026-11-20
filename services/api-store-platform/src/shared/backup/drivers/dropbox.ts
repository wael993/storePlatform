import { stat } from 'fs/promises'
import { config } from '../../../config/config'
import { decryptSecret, encryptSecret } from '../crypto'
import { BackupError } from '../errors'
import {
	fileBody,
	oauthToken,
	saveBody,
	STREAM_BODY,
	throwResponse,
} from './http'
import type { BackupConnection, BackupDriver } from './index'

const AUTH_URL = 'https://www.dropbox.com/oauth2/authorize'
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
const API = 'https://api.dropboxapi.com/2'
const CONTENT_API = 'https://content.dropboxapi.com/2'
// Single-request upload limit of /files/upload.
const MAX_SINGLE_UPLOAD = 150 * 1024 * 1024
const AUTH = 'DROPBOX_AUTH_ERROR'
const ACCESS = 'DROPBOX_ACCESS_ERROR'

const fail = (response: Response, what: string) =>
	throwResponse(
		response,
		response.status === 401 ? AUTH : ACCESS,
		`Dropbox ${what}`,
	)

// Dropbox-API-Arg is an HTTP header: non-ASCII (e.g. Arabic tenant names) must be \u-escaped.
const apiArg = (value: object) =>
	JSON.stringify(value).replace(
		/[\u007f-￿]/g,
		char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
	)

const credentials = () => ({
	client_id: config.backup.dropbox.appKey,
	client_secret: config.backup.dropbox.appSecret,
})

// Dropbox refresh tokens don't rotate, so nothing is saved back.
const accessToken = async (connection: BackupConnection) =>
	(
		await oauthToken(
			TOKEN_URL,
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
	).access_token

const accountEmail = async (token: string): Promise<string> => {
	const response = await fetch(`${API}/users/get_current_account`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
	})

	if (!response.ok) await fail(response, 'account check')

	return ((await response.json()) as { email?: string }).email ?? 'Dropbox'
}

export const dropboxDriver: BackupDriver = {
	configured: Boolean(
		config.backup.dropbox.appKey &&
		config.backup.dropbox.appSecret &&
		config.backup.oauthRedirectUri,
	),

	authorizeUrl(state) {
		return `${AUTH_URL}?${new URLSearchParams({
			client_id: config.backup.dropbox.appKey,
			redirect_uri: config.backup.oauthRedirectUri,
			response_type: 'code',
			// offline = refresh token; force_reapprove lets the owner pick another account
			token_access_type: 'offline',
			force_reapprove: 'true',
			state,
		})}`
	},

	async connect(tenantId, code) {
		const tokens = await oauthToken(
			TOKEN_URL,
			{
				...credentials(),
				grant_type: 'authorization_code',
				code,
				redirect_uri: config.backup.oauthRedirectUri,
			},
			AUTH,
		)

		if (!tokens.refresh_token) {
			throw new BackupError(AUTH, 'Dropbox returned no refresh token.')
		}

		return {
			config: { refreshToken: encryptSecret(tenantId, tokens.refresh_token) },
			accountLabel: await accountEmail(tokens.access_token),
		}
	},

	async testConnection(connection) {
		await accountEmail(await accessToken(connection))
	},

	// App-folder app: "/name" lands in Apps/<app name>/ only.
	async upload(connection, name, filePath) {
		const { size } = await stat(filePath)

		// shortcut: single request (≤150 MB compressed+encrypted); switch to upload sessions for bigger tenants
		if (size > MAX_SINGLE_UPLOAD) {
			throw new BackupError(
				ACCESS,
				`Backup ${size} bytes exceeds single upload limit.`,
			)
		}

		const response = await fetch(`${CONTENT_API}/files/upload`, {
			...STREAM_BODY,
			method: 'POST',
			headers: {
				Authorization: `Bearer ${await accessToken(connection)}`,
				'Content-Type': 'application/octet-stream',
				'Content-Length': String(size),
				'Dropbox-API-Arg': apiArg({
					path: `/${name}`,
					mode: 'add',
					autorename: true,
				}),
			},
			body: fileBody(filePath),
		})

		if (!response.ok) await fail(response, 'upload')

		const file = (await response.json()) as { id: string; size: number }

		return { storageId: file.id, size: file.size }
	},

	async download(connection, storageId, filePath) {
		const response = await fetch(`${CONTENT_API}/files/download`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${await accessToken(connection)}`,
				'Dropbox-API-Arg': apiArg({ path: storageId }),
			},
		})

		if (!response.ok || !response.body) await fail(response, 'download')

		await saveBody(response, filePath)
	},

	async remove(connection, storageId) {
		const response = await fetch(`${API}/files/delete_v2`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${await accessToken(connection)}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ path: storageId }),
		})

		// 409 path_lookup/not_found = already gone
		if (response.ok) return

		const text = await response.text()

		if (response.status === 409 && text.includes('not_found')) return

		throw new BackupError(
			response.status === 401 ? AUTH : ACCESS,
			`Dropbox delete failed: ${response.status} ${text}`,
		)
	},
}
