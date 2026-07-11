import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'

export const getApiErrorMessage = (
	apiError: unknown,
	fallback: string,
): string => {
	if (!apiError) return fallback

	const errorObj = apiError as FetchBaseQueryError & {
		data?: { message?: string }
		error?: string
	}

	if (errorObj.status === 'FETCH_ERROR') {
		return fallback
	}

	if (typeof errorObj.data === 'object' && errorObj.data?.message) {
		return errorObj.data.message
	}

	if (typeof errorObj.error === 'string' && errorObj.error.trim()) {
		return errorObj.error
	}

	return fallback
}
