import { v4 as uuidv4 } from 'uuid'

export const UUID_V4 =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isUuidV4 = (value: unknown): value is string =>
	typeof value === 'string' && UUID_V4.test(value)

export const resolveSyncClientId = (clientId?: string): string => {
	const trimmed = clientId?.trim()

	if (trimmed && isUuidV4(trimmed)) {
		return trimmed
	}

	return uuidv4()
}
