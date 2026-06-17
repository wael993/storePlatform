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

export interface DailyActionFiltersQueryParams {
	searchText?: string
	entryType?: string[]
	productName?: string[]
	supplier?: string[]
	customer?: string[]
	invoiceDateFrom?: string
	invoiceDateTo?: string
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

export interface DailyActionFilterValuesResponse {
	entryType: ProductFilterValueOption[]
	productName: ProductFilterValueOption[]
	supplier: ProductFilterValueOption[]
	customer: ProductFilterValueOption[]
}
export interface AddDailyActionRequestBody {
	entryType: DailyAction['entryType']
	productId?: string
	productName?: string
	supplierId?: string
	supplierName?: string
	partnerId?: string
	partnerName?: string
	customerId?: string
	customerName?: string
	expenseId?: string
	expenseName?: string
	currencyId: string
	currencyName: string
	unitId?: string
	unitName?: string
	weight?: string
	singleUnitPrice?: string
	totalPrice?: string
	invoiceNumber?: string
	invoiceDate: string
	note?: string
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

const buildDailyActionFilterQueryParams = (
	filters: DailyActionFiltersQueryParams,
): Record<string, string> => {
	const params: Record<string, string> = {}

	const setArrayParam = (
		key: keyof Omit<
			DailyActionFiltersQueryParams,
			'searchText' | 'invoiceDateFrom' | 'invoiceDateTo'
		>,
		values?: string[],
	) => {
		if (!values || values.length === 0) return
		const normalizedValues = values.map(value => value.trim()).filter(Boolean)
		if (normalizedValues.length === 0) return
		params[key] = normalizedValues.join(',')
	}

	const normalizedSearchText = filters.searchText?.trim()
	if (normalizedSearchText) {
		params.searchText = normalizedSearchText
	}

	const invoiceDateFrom = filters.invoiceDateFrom?.trim()
	if (invoiceDateFrom) {
		params.invoiceDateFrom = invoiceDateFrom
	}

	const invoiceDateTo = filters.invoiceDateTo?.trim()
	if (invoiceDateTo) {
		params.invoiceDateTo = invoiceDateTo
	}

	setArrayParam('entryType', filters.entryType)
	setArrayParam('productName', filters.productName)
	setArrayParam('supplier', filters.supplier)
	setArrayParam('customer', filters.customer)

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

		getSuppliers: builder.query({
			query: () => {
				return {
					url: 'suppliers',
					method: 'GET',
				}
			},
			transformResponse: (response: SuppliersAPIResponse) => {
				return response.data
			},
			providesTags: ['suppliers'],
		}),

		getSingleSupplier: builder.query<Supplier, string>({
			query: (supplierId: string) => ({
				url: `suppliers/${supplierId}`,
				method: 'GET',
			}),
			transformResponse: (response: Supplier) => {
				return response
			},
			providesTags: ['supplier'],
		}),

		getCustomers: builder.query<Customer[], void>({
			query: () => {
				return {
					url: 'customers',
					method: 'GET',
				}
			},
			transformResponse: (response: CustomersAPIResponse) => response.data,
			providesTags: ['customers'],
		}),

		getSingleCustomer: builder.query<Customer, string>({
			query: (customerId: string) => ({
				url: `customers/${customerId}`,
				method: 'GET',
			}),
			transformResponse: (response: Customer) => {
				return response
			},
			providesTags: ['customer'],
		}),

		getPartners: builder.query({
			query: () => {
				return {
					url: 'partners',
					method: 'GET',
				}
			},
			transformResponse: (response: PartnersAPIResponse) => {
				return response.data
			},
			providesTags: ['partners'],
		}),

		getSinglePartner: builder.query<Partner, string>({
			query: (partnerId: string) => ({
				url: `partners/${partnerId}`,
				method: 'GET',
			}),
			transformResponse: (response: Partner) => {
				return response
			},
			providesTags: ['partner'],
		}),

		getBudgetOverview: builder.query<
			BudgetOverviewAPIResponse | null,
			BudgetOverviewQueryArgument
		>({
			query: ({ entityType, id }: BudgetOverviewQueryArgument) => ({
				url: `budget-overview/${entityType}/${id}`,
				method: 'GET',
			}),
			providesTags: ['budget-overview'],
		}),

		getCurrencies: builder.query({
			query: () => {
				return {
					url: 'currencies',
					method: 'GET',
				}
			},
			transformResponse: (response: CurrenciesAPIResponse) => {
				return response.data
			},
			providesTags: ['currencies'],
		}),

		getUnits: builder.query({
			query: () => {
				return {
					url: 'units',
					method: 'GET',
				}
			},
			transformResponse: (response: UnitsAPIResponse) => {
				return response.data
			},
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
		getExpenses: builder.query<Expense[], void>({
			query: () => ({
				url: 'expenses',
				method: 'GET',
			}),
			transformResponse: (response: ExpensesAPIResponse) => {
				return response.data
			},
			providesTags: ['expenses'],
		}),
		getSingleExpense: builder.query<Expense, string>({
			query: (expenseId: string) => ({
				url: `expenses/${expenseId}`,
				method: 'GET',
			}),
			transformResponse: (response: Expense) => {
				return response
			},
			providesTags: ['expenses'],
		}),
		createExpense: builder.mutation<
			CreateExpenseAPIResponse,
			Omit<Expense, 'expenseId'>
		>({
			query: (newExpense: Omit<Expense, 'expenseId'>) => ({
				url: 'expenses',
				method: 'POST',
				body: newExpense,
			}),
			invalidatesTags: ['expenses'],
		}),
		updateExpense: builder.mutation<
			UpdateExpenseAPIResponse,
			{ id: string; body: Partial<Omit<Expense, 'expenseId'>> }
		>({
			query: ({ id, body }) => ({
				url: `expenses/${id}`,
				method: 'PATCH',
				body,
			}),
			invalidatesTags: ['expenses'],
		}),
		deleteExpense: builder.mutation<void, string>({
			query: (expenseId: string) => ({
				url: `expenses/${expenseId}`,
				method: 'DELETE',
			}),
			invalidatesTags: ['expenses'],
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
			Pick<Customer, 'name' | 'internalCode'>
		>({
			query: (newCustomer: Pick<Customer, 'name' | 'internalCode'>) => ({
				url: 'customers',
				method: 'POST',
				body: newCustomer,
			}),
			invalidatesTags: ['customers'],
		}),

		createPartner: builder.mutation<
			CreatePartnerAPIResponse,
			Omit<Partner, 'partnerId'>
		>({
			query: (newPartner: Omit<Partner, 'partnerId'>) => ({
				url: 'partners',
				method: 'POST',
				body: newPartner,
			}),
			invalidatesTags: ['partners'],
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

		getDailyActions: builder.query<
			DailyAction[],
			DailyActionFiltersQueryParams | void
		>({
			query: filters => ({
				url: 'daily-actions',
				method: 'GET',
				params: buildDailyActionFilterQueryParams(filters ?? {}),
			}),
			transformResponse: (response: { data: DailyAction[] }) => {
				return response.data
			},

			providesTags: ['daily-actions'],
		}),

		getDailyActionFilterValues: builder.query<
			DailyActionFilterValuesResponse,
			void
		>({
			query: () => ({
				url: 'daily-actions/filter-values',
				method: 'GET',
			}),
		}),

		getSingleDailyAction: builder.query<DailyActionsAPIResponse, string>({
			query: (actionId: string) => ({
				url: `daily-actions/${actionId}`,
				method: 'GET',
			}),
			providesTags: ['daily-action'],
		}),

		postDailyAction: builder.mutation<void, AddDailyActionRequestBody>({
			query: (body: AddDailyActionRequestBody) => {
				return {
					url: 'daily-actions',
					method: 'POST',
					body,
				}
			},
			invalidatesTags: [
				'daily-actions',
				'budget-overview',
				'customers',
				'customer',
				'suppliers',
				'supplier',
				'partners',
				'partner',
			],
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
			invalidatesTags: [
				'daily-actions',
				'daily-action',
				'budget-overview',
				'customers',
				'customer',
				'suppliers',
				'supplier',
			],
		}),

		deleteDailyAction: builder.mutation<void, string[]>({
			query: (actionIds: string[]) => ({
				url: 'daily-actions',
				method: 'DELETE',
				body: { actionIds },
			}),
			invalidatesTags: [
				'daily-actions',
				'budget-overview',
				'customers',
				'customer',
				'suppliers',
				'supplier',
			],
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
	useGetSingleSupplierQuery,
	useGetCustomersQuery,
	useGetSingleCustomerQuery,
	useGetPartnersQuery,
	useGetSinglePartnerQuery,
	useGetBudgetOverviewQuery,
	useGetCurrenciesQuery,
	useGetUnitsQuery,
	useGetSingleProductQuery,
	useEditProductMutation,
	useDeleteProductMutation,
	usePostProductMutation,
	useCreateSupplierMutation,
	useCreateCustomerMutation,
	useCreatePartnerMutation,
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
	useGetDailyActionFilterValuesQuery,
	useGetSingleDailyActionQuery,
	usePostDailyActionMutation,
	useUpdateDailyActionMutation,
	useDeleteDailyActionMutation,
	useGetExpensesQuery,
	useGetSingleExpenseQuery,
	useCreateExpenseMutation,
	useUpdateExpenseMutation,
	useDeleteExpenseMutation,
} = storeApi
