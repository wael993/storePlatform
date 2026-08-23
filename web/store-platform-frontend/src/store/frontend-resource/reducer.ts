import { createSlice } from '@reduxjs/toolkit'
import { matchPath } from 'react-router-dom'
import { storeApi } from '../../api/apiStore'

interface FrontendResourcesState {
	frontendResources: FrontendResources[]
	see: string[]
	currentRoute: string
	allowedActions?: string[]
	isLoading: boolean
	isUninitialized: boolean
}

const initialState: FrontendResourcesState = {
	frontendResources: [] as FrontendResources[],
	see: [],
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
				storeApi.endpoints.getUserFrontendResources.matchPending,
				state => {
					state.isLoading = true
					state.isUninitialized = false
				},
			)
			.addMatcher(
				storeApi.endpoints.getUserFrontendResources.matchFulfilled,
				(state, { payload }) => {
					state.frontendResources = payload.frontendResources
					state.see = payload.see ?? []
					state.isLoading = false
					state.isUninitialized = false
				},
			)
			.addMatcher(
				storeApi.endpoints.getUserFrontendResources.matchRejected,
				state => {
					state.isLoading = false
					state.isUninitialized = false
				},
			)
	},
})

export const { setCurrentRoute } = frontendResourceSlice.actions

export default frontendResourceSlice.reducer
