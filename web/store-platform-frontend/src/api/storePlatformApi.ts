import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { config } from '../config'
import { RootState } from '../store/store'

export type TagType = 'products' | 'product'

const tagTypes: TagType[] = ['products', 'product']

export const storePlatformApi = createApi({
	reducerPath: 'storePlatformAPI',
	tagTypes: tagTypes,
	baseQuery: fetchBaseQuery({
		baseUrl: `${config.endpoints.storePlatformEndpoint}`,
		credentials: 'include',
		prepareHeaders: (headers, { getState }) => {
			const state = getState() as RootState
			const token = state.user?.token // ✅ FIXED

			if (token) {
				headers.set('Authorization', `Bearer ${token}`)
			}
		},
	}),
	refetchOnMountOrArgChange: true,
	endpoints: () => ({}),
})
