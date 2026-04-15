import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import { config } from '../config'
import { RootState } from '../store/store'
import { setAccessToken, logout } from '../store/user/reducer'

export type TagType = 'products' | 'product'

const tagTypes: TagType[] = ['products', 'product']

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

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
	args,
	api,
	extraOptions,
) => {
	let result = await baseQuery(args, api, extraOptions)

	if (result.error?.status === 401) {
		// Attempt silent refresh
		const refreshResult = await baseQuery(
			{ url: 'refresh', method: 'POST', credentials: 'include' },
			api,
			extraOptions,
		)

		if (refreshResult.data) {
			const { accessToken } = refreshResult.data as { accessToken: string }
			api.dispatch(setAccessToken(accessToken))

			// Retry the original request with new token
			result = await baseQuery(args, api, extraOptions)
		} else {
			api.dispatch(logout())
		}
	}

	return result
}

export const storePlatformApi = createApi({
	reducerPath: 'storePlatformAPI',
	tagTypes: tagTypes,
	baseQuery: baseQueryWithReauth,
	refetchOnMountOrArgChange: true,
	endpoints: () => ({}),
})
