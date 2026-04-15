import { EndpointBuilder } from '@reduxjs/toolkit/query'
import {
	FetchArgs,
	FetchBaseQueryError,
} from '@reduxjs/toolkit/query'
import { BaseQueryFn } from '@reduxjs/toolkit/query/react'
import { storePlatformApi, TagType } from './storePlatformApi'

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
const getQuery = (
	builder: EndpointBuilder<
		BaseQueryFn<
			string | FetchArgs,
			unknown,
			FetchBaseQueryError
		>,
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
			query: (newProduct: Omit<ProductApi, '_id'>) => {
				console.log('🚀 ~ getQuery ~ newProduct:', newProduct)
				return {
					url: 'product',
					method: 'POST',
					body: newProduct,
				}
			},
			transformResponse: (response: ProductAPIResponse) => {
				console.log('🚀 ~ getQuery ~ response:', response)
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
} = storeApi
