import { EndpointBuilder } from '@reduxjs/toolkit/query'
import { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { BaseQueryFn } from '@reduxjs/toolkit/query/react'
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { storePlatformApi, TagType } from './storePlatformApi'
import { config } from '../config'
import type { TenantSummary, UpdateTenantRequest } from '../types/tenant'

// interface getProductsQueryArgument {
// 	activityId: string
// 	eventType: ActivityType
// }
interface LoginData {
	email: string
	password: string
}
interface LoginRequestBody {
	body: LoginData
}

const persistenceBaseQuery = fetchBaseQuery({
	baseUrl: `${config.endpoints.persistenceServiceEndpoint}`,
	credentials: 'include',
	prepareHeaders: headers => {
		headers.set('Origin', document.location.origin)
		headers.set('Access-Control-Allow-Credentials', 'true')
		return headers
	},
})

const getQuery = (
	builder: EndpointBuilder<
		BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>,
		TagType,
		'storePlatformAPI'
	>,
) => {
	return {
		getProducts: builder.query({
			query: () => {
				return {
					url: 'products',
				}
			},
			transformResponse: (response: ProductApi[]) => {
				return response
			},
			providesTags: ['products'],
		}),

		getSingleProduct: builder.query({
			query: (productId: string) => {
				return {
					url: `products/${productId}`,
				}
			},
			transformResponse: (response: ProductApi) => {
				return response
			},
			providesTags: ['product'],
		}),
		editProduct: builder.mutation({
			query: (productId: string) => {
				return {
					url: `products/${productId}`,
					method: 'POST',
				}
			},
			transformResponse: (response: ProductAPIResponse) => {
				return response.data
			},
			invalidatesTags: ['products', 'product'],
		}),
		deleteProduct: builder.mutation({
			query: (productId: string) => {
				return {
					url: `products/${productId}`,
					method: 'DELETE',
				}
			},
			transformResponse: (response: ProductAPIResponse) => {
				return response.data
			},
			invalidatesTags: ['products', 'product'],
		}),
		postProduct: builder.mutation({
			query: (newProduct: Omit<ProductApi, '_id' | 'productId'>) => {
				return {
					url: 'product',
					method: 'POST',
					body: newProduct,
				}
			},
			transformResponse: (response: ProductAPIResponse) => {
				return response.data
			},
			invalidatesTags: ['products'],
		}),

		login: builder.mutation<LoginAPI, LoginRequestBody>({
			query: ({ body }) => ({
				url: 'login',
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body,
			}),

			transformResponse: (response: LoginAPI) => {
				if (!response) {
					throw new Error('No user returned from API')
				}
				return response
			},
		}),

		logoutCurrent: builder.mutation<void, void>({
			query: () => ({
				url: 'logout',
				method: 'POST',
				credentials: 'include',
			}),
		}),

		logoutAll: builder.mutation<{ sessionsRevoked: number }, void>({
			query: () => ({
				url: 'logout-all',
				method: 'POST',
				credentials: 'include',
			}),
		}),

		getTenantUsers: builder.query<TenantUser[], void>({
			query: () => ({
				url: 'users',
			}),
			providesTags: ['tenant-users'],
		}),

		inviteTenantUser: builder.mutation<
			InviteTenantUserResponse,
			InviteTenantUserRequest
		>({
			query: body => ({
				url: 'users/invite',
				method: 'POST',
				body,
			}),
			invalidatesTags: ['tenant-users'],
		}),

		updateTenantUser: builder.mutation<
			TenantUser,
			{ userId: string; body: UpdateTenantUserRequest }
		>({
			query: ({ userId, body }) => ({
				url: `users/${userId}`,
				method: 'PATCH',
				body,
			}),
			invalidatesTags: ['tenant-users'],
		}),

		deleteTenantUser: builder.mutation<void, string>({
			query: userId => ({
				url: `users/${userId}`,
				method: 'DELETE',
			}),
			invalidatesTags: ['tenant-users'],
		}),

		addTenant: builder.mutation<AddTenantResponse, AddTenantRequest>({
			query: body => ({
				url: 'tenants',
				method: 'POST',
				body,
			}),
			invalidatesTags: ['tenants'],
		}),

		getTenants: builder.query<TenantSummary[], void>({
			query: () => ({
				url: 'tenants',
			}),
			providesTags: ['tenants'],
		}),

		updateTenant: builder.mutation<
			TenantSummary,
			{ tenantId: string; body: UpdateTenantRequest }
		>({
			query: ({ tenantId, body }) => ({
				url: `tenants/${tenantId}`,
				method: 'PATCH',
				body,
			}),
			invalidatesTags: ['tenants'],
		}),

		deleteTenant: builder.mutation<void, string>({
			query: tenantId => ({
				url: `tenants/${tenantId}`,
				method: 'DELETE',
			}),
			invalidatesTags: ['tenants'],
		}),

		getUser: builder.query<User, void>({
			async queryFn(_arg, api, extraOptions, baseQuery) {
				const result = await persistenceBaseQuery(
					{
						url: '/user',
					},
					api,
					extraOptions,
				)

				if (result.error) {
					return { error: result.error }
				}

				const response = result.data as { documents: User[] }
				return { data: response.documents[0] }
			},
		}),

		getUserFrontendResources: builder.query<FrontendResources[], string>({
			query: userId => ({
				url: `user/${userId}/frontend-resources`,
				method: 'GET',
			}),
			transformResponse: (response: {
				frontendResources: FrontendResources[]
			}) => {
				return response.frontendResources
			},
		}),
		changePassword: builder.mutation<
			void,
			{ currentPassword: string; newPassword: string }
		>({
			query: body => ({
				url: 'users/me/password',
				method: 'PATCH',
				body,
			}),
		}),
	}
}

export const storeApi = storePlatformApi.injectEndpoints({
	endpoints: builder => getQuery(builder),
	overrideExisting: true,
})

export const {
	useGetProductsQuery,
	useGetSingleProductQuery,
	useEditProductMutation,
	useDeleteProductMutation,
	usePostProductMutation,
	useLoginMutation,
	useLogoutCurrentMutation,
	useLogoutAllMutation,
	useGetTenantUsersQuery,
	useInviteTenantUserMutation,
	useUpdateTenantUserMutation,
	useDeleteTenantUserMutation,
	useAddTenantMutation,
	useGetTenantsQuery,
	useGetUserQuery,
	useGetUserFrontendResourcesQuery,
	useUpdateTenantMutation,
	useDeleteTenantMutation,
	useChangePasswordMutation,
} = storeApi
