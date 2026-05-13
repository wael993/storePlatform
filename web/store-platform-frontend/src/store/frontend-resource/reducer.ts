import { createSlice } from '@reduxjs/toolkit'
import { matchPath } from 'react-router-dom'
import { userApi } from '../../api/user'

interface FrontendResourcesState {
	frontendResources: FrontendResources[]
	currentRoute: string
	allowedActions?: string[]
	isLoading: boolean
	isUninitialized: boolean
}

const initialState: FrontendResourcesState = {
	frontendResources: [] as FrontendResources[],
	currentRoute: '',
	allowedActions: [],
	isLoading: false,
	isUninitialized: true,
}

export const frontendResourceSlice = createSlice({
	name: 'frontend-resource',
	initialState,
	reducers: {
		setCurrentRoute: (state, action) => {
			const { currentRoute } = action.payload

			const allowedActions = state.frontendResources?.find(
				(resource: FrontendResources) => {
					const match = matchPath(
						{ path: resource.path, end: true },
						currentRoute,
					)
					return !!match
				},
			)?.allowedActions

			return {
				...state,
				currentRoute: currentRoute,
				allowedActions: allowedActions,
			}
		},
	},
	extraReducers: builder => {
		builder
			.addMatcher(
				userApi.endpoints.getUserFrontendResources.matchPending,
				state => {
					state.isLoading = true
					state.isUninitialized = false
				},
			)
			.addMatcher(
				userApi.endpoints.getUserFrontendResources.matchFulfilled,
				(state, { payload }) => {
					state.frontendResources = payload
					state.isLoading = false
					state.isUninitialized = false
				},
			)
			.addMatcher(
				userApi.endpoints.getUserFrontendResources.matchRejected,
				state => {
					state.isLoading = false
					state.isUninitialized = false
				},
			)
	},
})

export const { setCurrentRoute } = frontendResourceSlice.actions

export default frontendResourceSlice.reducer
