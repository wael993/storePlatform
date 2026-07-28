import {
	createApi,
	fetchBaseQuery,
	BaseQueryFn,
	FetchArgs,
	FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'
import { config } from '../config'
import { RootState } from '../store/store'
import { setAccessToken, logout } from '../store/user/reducer'
import {
	getIsOnline,
	markOnline,
	setOnlineFromFetchResult,
} from '../offline/connectivity'
import {
	handleOfflineQuery,
	isOfflineCapableEndpoint,
} from '../offline/localHandlers'
import { isOfflineCapableForTenant } from '../offline/localStore'

export type TagType =
	| 'products'
	| 'product'
	| 'tenant-users'
	| 'tenants'
	| 'user-settings'
	| 'currency-settings'
	| 'invoice-settings'
	| 'daily-actions'
	| 'daily-action'
	| 'suppliers'
	| 'supplier'
	| 'customers'
	| 'customer'
	| 'categories'
	| 'brands'
	| 'brand'
	| 'shelves'
	| 'shelf'
	| 'warehouses'
	| 'warehouse'
	| 'partners'
	| 'partner'
	| 'budget-overview'
	| 'currencies'
	| 'units'
	| 'expenses'
	| 'selling-invoices'
	| 'buying-invoices'
	| 'inventory'
	| 'frontend-resources'

const tagTypes: TagType[] = [
	'products',
	'product',
	'tenant-users',
	'tenants',
	'user-settings',
	'currency-settings',
	'invoice-settings',
	'daily-actions',
	'daily-action',
	'suppliers',
	'supplier',
	'customers',
	'customer',
	'categories',
	'brands',
	'brand',
	'shelves',
	'shelf',
	'warehouses',
	'warehouse',
	'partners',
	'partner',
	'budget-overview',
	'currencies',
	'units',
	'expenses',
	'selling-invoices',
	'buying-invoices',
	'inventory',
	'frontend-resources',
]

const baseQuery = fetchBaseQuery({
	baseUrl: `${config.endpoints.storePlatformEndpoint}`,
	credentials: 'include',
	prepareHeaders: (headers, { getState }) => {
		const state = getState() as RootState
		const token = state.user?.accessToken

		if (token) {
			headers.set('Authorization', `Bearer ${token}`)
		}
		return headers
	},
})

const getRequestUrl = (args: string | FetchArgs): string =>
	typeof args === 'string' ? args : args.url

const getRequestMethod = (args: string | FetchArgs): string => {
	if (typeof args === 'string') return 'GET'
	return (args.method ?? 'GET').toUpperCase()
}

const tryServeOfflineQuery = async (
	args: string | FetchArgs,
): Promise<{ data: unknown } | null> => {
	const localResult = await handleOfflineQuery(args)
	if ('data' in localResult) {
		return localResult as { data: unknown }
	}
	return null
}

const shouldFallbackToOffline = (
	error: FetchBaseQueryError | undefined,
): boolean => {
	if (!error) return false

	if (error.status === 'FETCH_ERROR' || error.status === 'PARSING_ERROR') {
		return true
	}

	return typeof error.status === 'number' && error.status >= 500
}

const baseQueryWithReauth: BaseQueryFn<
	string | FetchArgs,
	unknown,
	FetchBaseQueryError
> = async (args, api, extraOptions) => {
	let result = await baseQuery(args, api, extraOptions)

	const requestUrl = getRequestUrl(args)
	const isAuthRequest = requestUrl === 'login' || requestUrl === 'refresh'

	if (result.error?.status === 401 && !isAuthRequest) {
		const tenantId = (api.getState() as RootState).user?.user?.tenantId
		const offlineCapable = await isOfflineCapableForTenant(tenantId)
		const canServeOffline =
			offlineCapable && isOfflineCapableEndpoint(requestUrl)

		if (canServeOffline && !getIsOnline()) {
			const localResult = await tryServeOfflineQuery(args)
			if (localResult) return localResult
		}

		const refreshResult = await baseQuery(
			{ url: 'refresh', method: 'POST', credentials: 'include' },
			api,
			extraOptions,
		)

		if (refreshResult.data) {
			const { accessToken } = refreshResult.data as { accessToken: string }
			api.dispatch(setAccessToken(accessToken))

			result = await baseQuery(args, api, extraOptions)
		} else if (canServeOffline) {
			const localResult = await tryServeOfflineQuery(args)
			if (localResult) return localResult
		} else {
			api.dispatch(logout())
		}
	}

	return result
}

const baseQueryWithOffline: BaseQueryFn<
	string | FetchArgs,
	unknown,
	FetchBaseQueryError
> = async (args, api, extraOptions) => {
	const requestUrl = getRequestUrl(args)
	const method = getRequestMethod(args)
	const state = api.getState() as RootState
	const tenantId = state.user?.user?.tenantId
	const accessToken = state.user?.accessToken
	const offlineCapable = await isOfflineCapableForTenant(tenantId)
	const canServeOffline = offlineCapable && isOfflineCapableEndpoint(requestUrl)
	const preferOfflineReads =
		canServeOffline && method === 'GET' && (!accessToken || !getIsOnline())

	if (preferOfflineReads) {
		const localResult = await tryServeOfflineQuery(args)
		if (localResult) return localResult
	}

	if (!getIsOnline()) {
		if (canServeOffline) {
			const localResult = await tryServeOfflineQuery(args)
			if (localResult) return localResult

			return {
				error: {
					status: 503,
					data: { message: 'Offline data unavailable' },
				},
			}
		}

		return {
			error: {
				status: 503,
				data: {
					message:
						'Offline mode is not ready. Connect to the internet and sync once.',
				},
			},
		}
	}

	const result = await baseQueryWithReauth(args, api, extraOptions)

	if (shouldFallbackToOffline(result.error) && canServeOffline) {
		setOnlineFromFetchResult(true)
		const localResult = await tryServeOfflineQuery(args)
		if (localResult) return localResult
	}

	if (!result.error) {
		markOnline()
	}

	return result
}

export const storePlatformApi = createApi({
	reducerPath: 'storePlatformAPI',
	tagTypes: tagTypes,
	baseQuery: baseQueryWithOffline,
	refetchOnMountOrArgChange: true,
	endpoints: () => ({}),
})
