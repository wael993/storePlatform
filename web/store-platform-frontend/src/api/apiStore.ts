import { EndpointBuilder } from '@reduxjs/toolkit/query'
import { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { BaseQueryFn } from '@reduxjs/toolkit/query/react'
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { storePlatformApi, TagType } from './storePlatformApi'
import { config } from '../config'
import type { TenantSummary, UpdateTenantRequest } from '../types/tenant'

interface LoginData {
	email: string
	password: string
}
interface LoginRequestBody {
	body: LoginData
}

interface EditProductQueryArgument {
	id: string
	body: Partial<Omit<Product, 'id' | 'productId'>>
}

export interface ProductFiltersQueryParams {
	searchText?: string
	supplier?: string[]
	brand?: string[]
	state?: string[]
	category?: string[]
}

export interface ProductPaginationParams {
	limit?: number
	offset?: number
}

export interface ProductsResponse {
	products: Product[]
	totalCount: number
}

export interface ProductFilterValueOption {
	value: string
	label: string
}

type ProductFilterParamValue = string | ProductFilterValueOption | null | undefined

export interface ProductFilterValuesResponse {
	supplier: ProductFilterValueOption[]
	brand: ProductFilterValueOption[]
	state: ProductFilterValueOption[]
	category: ProductFilterValueOption[]
}

const buildProductFilterQueryParams = (
	filters: ProductFiltersQueryParams,
	pagination?: ProductPaginationParams,
): Record<string, string | number> => {
	const params: Record<string, string | number> = {}

	const normalizeFilterValue = (value: ProductFilterParamValue): string => {
		if (typeof value === 'string') {
			return value.trim()
		}

		if (value && typeof value.value === 'string') {
			return value.value.trim()
		}

		return ''
	}

	const setArrayParam = (
		key: string,
		values?: Array<ProductFilterParamValue>,
	) => {
		if (!values || values.length === 0) return
		const normalizedValues = values.map(normalizeFilterValue).filter(Boolean)
		if (normalizedValues.length === 0) return
		params[key] = normalizedValues.join(',')
	}

	const normalizedSearchText = filters.searchText?.trim()
	if (normalizedSearchText) {
		params.searchText = normalizedSearchText
	}

	setArrayParam('supplier', filters.supplier)
	setArrayParam('brand', filters.brand)
	setArrayParam('state', filters.state)
	setArrayParam('category', filters.category)

	if (pagination?.limit !== undefined) {
		params.limit = pagination.limit
	}
	if (pagination?.offset !== undefined) {
		params.offset = pagination.offset
	}

	return params
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
		getProducts: builder.query<
			ProductsResponse,
			ProductFiltersQueryParams & ProductPaginationParams
		>({
			query: (args = {}) => {
				const { limit, offset, ...filters } = args
				return {
					url: 'products',
					params: buildProductFilterQueryParams(
						filters as ProductFiltersQueryParams,
						{ limit, offset },
					),
				}
			},
			transformResponse: (response: ProductsResponse) => {
				return response
			},
			providesTags: ['products'],
		}),

		getFilterValues: builder.query<ProductFilterValuesResponse, void>({
			query: () => ({
				url: 'filter-values',
				method: 'GET',
			}),
		}),

		getSingleProduct: builder.query({
			query: (productId: string) => {
				return {
					url: `products/${productId}`,
				}
			},
			transformResponse: (response: Product) => {
				return response
			},
			providesTags: ['product'],
		}),
		editProduct: builder.mutation<void, EditProductQueryArgument>({
			query: ({ id, body }: EditProductQueryArgument) => {
				return {
					url: `products/${id}`,
					method: 'PATCH',
					body,
				}
			},
			invalidatesTags: ['products', 'product'],
		}),
		deleteProduct: builder.mutation<void, string>({
			query: (productId: string) => {
				return {
					url: `products/${productId}`,
					method: 'DELETE',
				}
			},
			invalidatesTags: ['products', 'product'],
		}),
		postProduct: builder.mutation<
			{ id: string },
			Omit<Product, 'id' | 'productId'>
		>({
			query: (newProduct: Omit<Product, '_id' | 'productId'>) => {
				return {
					url: 'product',
					method: 'POST',
					body: newProduct,
				}
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
	useGetFilterValuesQuery,
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
