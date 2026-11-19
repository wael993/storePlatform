import { createReadStream, createWriteStream } from 'fs'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { BackupError } from '../errors'

/** Throws a classified error carrying the provider's response (logged, never shown to customers). */
export const throwResponse = async (
	response: Response,
	code: string,
	what: string,
): Promise<never> => {
	throw new BackupError(
		code,
		`${what} failed: ${response.status} ${await response.text()}`,
	)
}

/** OAuth2 token endpoint call; any failure (e.g. revoked consent → invalid_grant) is an auth error. */
export const oauthToken = async (
	url: string,
	params: Record<string, string>,
	authErrorCode: string,
): Promise<{ access_token: string; refresh_token?: string }> => {
	const response = await fetch(url, {
		method: 'POST',
		body: new URLSearchParams(params),
	})

	if (!response.ok)
		await throwResponse(response, authErrorCode, 'Token request')

	return (await response.json()) as {
		access_token: string
		refresh_token?: string
	}
}

/** Streams a local file as a fetch body (pair with `duplex: 'half'`). */
export const fileBody = (filePath: string): BodyInit =>
	Readable.toWeb(createReadStream(filePath)) as unknown as BodyInit

export const STREAM_BODY = { duplex: 'half' } as unknown as RequestInit

export const saveBody = (response: Response, filePath: string): Promise<void> =>
	pipeline(
		Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
		createWriteStream(filePath),
	)
