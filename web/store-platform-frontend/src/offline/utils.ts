export const generateId = (): string => {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID()
	}

	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
		const random = (Math.random() * 16) | 0
		const value = char === 'x' ? random : (random & 0x3) | 0x8
		return value.toString(16)
	})
}

export const nowIso = (): string => new Date().toISOString()

export const resolveRecordId = (
	record: Record<string, unknown>,
	idField: string,
	fallbacks: string[] = ['_id'],
): string | undefined => {
	for (const field of [idField, ...fallbacks]) {
		const value = record[field]
		if (value !== undefined && value !== null && String(value).trim() !== '') {
			return String(value)
		}
	}

	return undefined
}

export const normalizeBootstrapRecords = (
	records: unknown[] | undefined,
	idField: string,
	fallbacks: string[] = ['_id'],
): Record<string, unknown>[] => {
	if (!records?.length) return []

	return records.flatMap(record => {
		if (!record || typeof record !== 'object') return []

		const typedRecord = record as Record<string, unknown>
		const id = resolveRecordId(typedRecord, idField, fallbacks)
		if (!id) return []

		return [{ ...typedRecord, [idField]: id }]
	})
}

export const withLocalMeta = <T>(
	record: T,
	syncStatus: 'synced' | 'pending' = 'synced',
	clientId?: string,
): T & { syncStatus: 'synced' | 'pending'; updatedAt: string; clientId?: string } => ({
	...record,
	syncStatus,
	clientId:
		clientId ??
		(record as T & { clientId?: string }).clientId,
	updatedAt: nowIso(),
})

export const parseUrlPath = (url: string): { path: string; params: URLSearchParams } => {
	const [pathPart, queryPart] = url.split('?')
	return {
		path: pathPart.replace(/^\//, ''),
		params: new URLSearchParams(queryPart ?? ''),
	}
}

const appendParamValue = (params: URLSearchParams, key: string, value: unknown) => {
	if (value === undefined || value === null) return

	if (Array.isArray(value)) {
		const normalizedValues = value.map(String).filter(Boolean)
		if (normalizedValues.length === 0) return
		params.set(key, normalizedValues.join(','))
		return
	}

	params.set(key, String(value))
}

export const resolveRequestParams = (
	args: string | { url: string; params?: Record<string, unknown> },
): URLSearchParams => {
	const url = typeof args === 'string' ? args : args.url
	const { params } = parseUrlPath(url)

	if (typeof args !== 'string' && args.params) {
		for (const [key, value] of Object.entries(args.params)) {
			appendParamValue(params, key, value)
		}
	}

	return params
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
