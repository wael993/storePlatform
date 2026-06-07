import { EndpointBuilder } from '@reduxjs/toolkit/query'
import { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { BaseQueryFn } from '@reduxjs/toolkit/query/react'
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { storePlatformApi, TagType } from './storePlatformApi'
import { config } from '../config'

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

export interface UserSettings {
	_id?: string
	tenantId: string
	userId: string
	productsPerPage: number
	displayLanguage: 'en' | 'de' | 'ar'
	createdAt?: string
	updatedAt?: string
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

export interface ProductFilterValuesResponse {
	supplier: ProductFilterValueOption[]
	brand: ProductFilterValueOption[]
	state: ProductFilterValueOption[]
	category: ProductFilterValueOption[]
}
interface EntryType {
	value: string
	label: string
}

export interface AddDailyActionRequestBody {
	entryType: EntryType
	productId: string
	productName: string
	supplierId?: string
	supplierName?: string
	customerId?: string
	customerName?: string
	currencyId: string
	currencyName: string
	unitId: string
	unitName: string
	weight: string
	singleUnitPrice?: string
	totalPrice?: string
}

const buildProductFilterQueryParams = (
	filters: ProductFiltersQueryParams,
	pagination?: ProductPaginationParams,
): Record<string, string | number> => {
	const params: Record<string, string | number> = {}

	const setArrayParam = (key: string, values?: string[]) => {
		if (!values || values.length === 0) return
		const normalizedValues = values.map(value => value.trim()).filter(Boolean)
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

		// getSuppliers: builder.query({
		// 	query: () => {
		// 		return {
		// 			url: 'suppliers',
		// 			method: 'GET',
		// 		}
		// 	},
		// 	transformResponse: (response: SuppliersAPIResponse) => {
		// 		return response.data
		// 	},
		// 	providesTags: ['suppliers'],
		// }),

		getSuppliers: builder.query<{ value: string; label: string }[], void>({
			query: () => ({
				url: 'suppliers',
				method: 'GET',
			}),
			providesTags: ['suppliers'],
		}),

		getCustomers: builder.query<{ value: string; label: string }[], void>({
			query: () => ({
				url: 'customers',
				method: 'GET',
			}),
			providesTags: ['customers'],
		}),

		getCurrencies: builder.query<{ value: string; label: string }[], void>({
			query: () => ({
				url: 'currencies',
				method: 'GET',
			}),
			providesTags: ['currencies'],
		}),

		getUnits: builder.query<{ value: string; label: string }[], void>({
			query: () => ({
				url: 'units',
				method: 'GET',
			}),
			providesTags: ['units'],
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
			CreateProductAPIResponse,
			Omit<Product, 'productId'>
		>({
			query: (newProduct: Omit<Product, 'productId'>) => {
				return {
					url: 'product',
					method: 'POST',
					body: newProduct,
				}
			},
			invalidatesTags: ['products'],
		}),
		createSupplier: builder.mutation<
			CreateSupplierAPIResponse,
			Omit<Supplier, 'supplierId'>
		>({
			query: (newSupplier: Omit<Supplier, 'supplierId'>) => ({
				url: 'suppliers',
				method: 'POST',
				body: newSupplier,
			}),
			invalidatesTags: ['suppliers'],
		}),

		createCustomer: builder.mutation<
			CreateCustomerAPIResponse,
			Omit<Customer, 'customerId'>
		>({
			query: (newCustomer: Omit<Customer, 'customerId'>) => ({
				url: 'customers',
				method: 'POST',
				body: newCustomer,
			}),
			invalidatesTags: ['customers'],
		}),

		createCurrency: builder.mutation<
			CreateCurrencyAPIResponse,
			Omit<Currency, 'currencyId'>
		>({
			query: (newCurrency: Omit<Currency, 'currencyId'>) => ({
				url: 'currencies',
				method: 'POST',
				body: newCurrency,
			}),
			invalidatesTags: ['currencies'],
		}),

		createUnit: builder.mutation<CreateUnitAPIResponse, Omit<Unit, 'unitId'>>({
			query: (newUnit: Omit<Unit, 'unitId'>) => ({
				url: 'units',
				method: 'POST',
				body: newUnit,
			}),
			invalidatesTags: ['units'],
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
		getUserSettings: builder.query<UserSettings, void>({
			query: () => ({
				url: 'user-settings',
				method: 'GET',
			}),
			providesTags: ['user-settings'],
		}),
		updateUserSettings: builder.mutation<
			UserSettings,
			Partial<Omit<UserSettings, 'tenantId' | 'userId' | '_id'>>
		>({
			query: body => ({
				url: 'user-settings',
				method: 'PATCH',
				body,
			}),
			invalidatesTags: ['user-settings'],
		}),

		getDailyActions: builder.query<DailyActionsAPIResponse[], void>({
			query: () => ({
				url: 'daily-actions',
				method: 'GET',
			}),
			transformResponse: (response: { data: DailyActionsAPIResponse[] }) => {
				return response.data
			},

			providesTags: ['daily-actions'],
		}),

		getSingleDailyAction: builder.query<DailyActionsAPIResponse, string>({
			query: (actionId: string) => ({
				url: `daily-actions/${actionId}`,
				method: 'GET',
			}),
			providesTags: ['daily-action'],
		}),

		postDailyAction: builder.mutation<void, AddDailyActionRequestBody>({
			query: (body: AddDailyActionRequestBody) => ({
				url: 'daily-actions',
				method: 'POST',
				body,
			}),
			invalidatesTags: ['daily-actions'],
		}),

		updateDailyAction: builder.mutation<
			DailyActionsAPIResponse,
			{ id: string; body: any }
		>({
			query: ({ id, body }: { id: string; body: any }) => ({
				url: `daily-actions/${id}`,
				method: 'PATCH',
				body,
			}),
			invalidatesTags: ['daily-actions', 'daily-action'],
		}),

		deleteDailyAction: builder.mutation({
			query: (actionId: string) => ({
				url: `daily-actions/${actionId}`,
				method: 'DELETE',
			}),
			invalidatesTags: ['daily-actions'],
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
	useGetSuppliersQuery,
	useGetCustomersQuery,
	useGetCurrenciesQuery,
	useGetUnitsQuery,
	useGetSingleProductQuery,
	useEditProductMutation,
	useDeleteProductMutation,
	usePostProductMutation,
	useCreateSupplierMutation,
	useCreateCustomerMutation,
	useCreateCurrencyMutation,
	useCreateUnitMutation,
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
	useGetUserSettingsQuery,
	useUpdateUserSettingsMutation,
	useGetDailyActionsQuery,
	useGetSingleDailyActionQuery,
	usePostDailyActionMutation,
	useUpdateDailyActionMutation,
	useDeleteDailyActionMutation,
} = storeApi
