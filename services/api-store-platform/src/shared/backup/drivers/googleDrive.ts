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

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
// drive.file: the app only sees files it created, never the customer's other files
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

const fail = (response: Response, what: string) =>
	throwResponse(
		response,
		response.status === 401 ? 'GOOGLE_AUTH_ERROR' : 'GOOGLE_DRIVE_ACCESS_ERROR',
		`Google Drive ${what}`,
	)

const tokenRequest = (params: Record<string, string>) =>
	oauthToken(
		TOKEN_URL,
		{
			client_id: config.backup.googleDrive.clientId,
			client_secret: config.backup.googleDrive.clientSecret,
			...params,
		},
		'GOOGLE_AUTH_ERROR',
	)

// Access tokens are short-lived; minting one per operation avoids storing them.
const accessToken = async (connection: BackupConnection): Promise<string> =>
	(
		await tokenRequest({
			grant_type: 'refresh_token',
			refresh_token: decryptSecret(
				connection.tenantId,
				connection.config.refreshToken,
			),
		})
	).access_token

const accountEmail = async (token: string): Promise<string> => {
	const response = await fetch(`${API}/about?fields=user(emailAddress)`, {
		headers: { Authorization: `Bearer ${token}` },
	})

	if (!response.ok) await fail(response, 'account check')

	const body = (await response.json()) as { user?: { emailAddress?: string } }

	return body.user?.emailAddress ?? 'Google Drive'
}

export const googleDriveDriver: BackupDriver = {
	configured: Boolean(
		config.backup.googleDrive.clientId &&
			config.backup.googleDrive.clientSecret &&
			config.backup.oauthRedirectUri,
	),

	authorizeUrl(state) {
		return `${AUTH_URL}?${new URLSearchParams({
			client_id: config.backup.googleDrive.clientId,
			redirect_uri: config.backup.oauthRedirectUri,
			response_type: 'code',
			scope: SCOPE,
			access_type: 'offline',
			// consent + select_account: always returns a refresh token and allows switching account
			prompt: 'consent select_account',
			state,
		})}`
	},

	async connect(tenantId, code) {
		const tokens = await tokenRequest({
			grant_type: 'authorization_code',
			code,
			redirect_uri: config.backup.oauthRedirectUri,
		})

		if (!tokens.refresh_token) {
			throw new BackupError(
				'GOOGLE_AUTH_ERROR',
				'Google returned no refresh token.',
			)
		}

		return {
			config: { refreshToken: encryptSecret(tenantId, tokens.refresh_token) },
			accountLabel: await accountEmail(tokens.access_token),
		}
	},

	async testConnection(connection) {
		await accountEmail(await accessToken(connection))
	},

	async upload(connection, name, filePath) {
		const token = await accessToken(connection)
		const { size } = await stat(filePath)
		// fields=id,size: the final PUT answers with both, no extra lookup needed
		const session = await fetch(
			`${UPLOAD_API}/files?uploadType=resumable&fields=id,size`,
			{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json; charset=UTF-8',
				'X-Upload-Content-Type': 'application/octet-stream',
				'X-Upload-Content-Length': String(size),
			},
			body: JSON.stringify({ name, mimeType: 'application/octet-stream' }),
			},
		)

		if (!session.ok) await fail(session, 'upload start')

		const location = session.headers.get('location')

		if (!location) {
			throw new BackupError(
				'UPLOAD_ERROR',
				'Google Drive returned no upload URL.',
			)
		}

		// shortcut: single PUT, no chunk resume; fine for tenant-sized archives, chunk it if uploads time out
		const upload = await fetch(location, {
			...STREAM_BODY,
			method: 'PUT',
			headers: { 'Content-Length': String(size) },
			body: fileBody(filePath),
		})

		if (!upload.ok) await fail(upload, 'upload')

		const file = (await upload.json()) as { id?: string; size?: string }
		const uploadedSize = Number(file.size)

		if (!file.id || !Number.isFinite(uploadedSize)) {
			throw new BackupError(
				'UPLOAD_ERROR',
				`Google Drive answered without id/size: ${JSON.stringify(file)}`,
			)
		}

		return { storageId: file.id, size: uploadedSize }
	},

	async download(connection, storageId, filePath) {
		const response = await fetch(
			`${API}/files/${encodeURIComponent(storageId)}?alt=media`,
			{ headers: { Authorization: `Bearer ${await accessToken(connection)}` } },
		)

		if (!response.ok || !response.body) await fail(response, 'download')

		await saveBody(response, filePath)
	},

	async remove(connection, storageId) {
		const response = await fetch(
			`${API}/files/${encodeURIComponent(storageId)}`,
			{
				method: 'DELETE',
				headers: { Authorization: `Bearer ${await accessToken(connection)}` },
			},
		)

		if (!response.ok && response.status !== 404) await fail(response, 'delete')
	},
}
