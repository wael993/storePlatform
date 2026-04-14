import { EndpointBuilder } from '@reduxjs/toolkit/query'
import {
	FetchArgs,
	FetchBaseQueryError,
	FetchBaseQueryMeta,
} from '@reduxjs/toolkit/query'
import {
	BaseQueryFn,
	createApi,
	fetchBaseQuery,
} from '@reduxjs/toolkit/query/react'
import { config } from '../config'

interface CustomError {
	status: number
	data: { errorCode: string; message: string; hint?: string }
}

const getUser = (
	builder: EndpointBuilder<
		BaseQueryFn<
			string | FetchArgs,
			unknown,
			FetchBaseQueryError,
			{},
			FetchBaseQueryMeta
		>,
		never,
		'userApi'
	>,
) => {
	return builder.query<User, void>({
		query: () => `${config.endpoints.persistenceServiceEndpoint}/user`,
		transformResponse: (response: { documents: User[] }) => {
			const user = response.documents[0]
			return user
		},
	})
}

const getUserFrontendResources = (
	builder: EndpointBuilder<
		BaseQueryFn<
			string | FetchArgs,
			unknown,
			FetchBaseQueryError,
			{},
			FetchBaseQueryMeta
		>,
		never,
		'userApi'
	>,
) => {
	return builder.query({
		query: userId =>
			`${config.endpoints.persistenceServiceEndpoint}/user/${userId}/frontend-resources`,
		transformResponse: (response: {
			frontendResources: FrontendResources[]
		}) => {
			const frontendResources = response.frontendResources

			return frontendResources
		},
	})
}

export const userApi = createApi({
	reducerPath: 'userApi',
	baseQuery: fetchBaseQuery({
		baseUrl: `${config.endpoints.persistenceServiceEndpoint}/user`,
		credentials: 'include',
		prepareHeaders: headers => {
			headers.set('Origin', document.location.origin)
			headers.set('Access-Control-Allow-Credentials', 'true')
			return headers
		},
	}) as BaseQueryFn<
		string | FetchArgs,
		unknown,
		CustomError,
		{},
		FetchBaseQueryMeta
	>,
	refetchOnMountOrArgChange: true,
	endpoints: builder => ({
		getUser: getUser(builder),

		getUserFrontendResources: getUserFrontendResources(builder),
	}),
})

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useGetUserQuery, useGetUserFrontendResourcesQuery } = userApi
