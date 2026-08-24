import { configureStore } from '@reduxjs/toolkit'

import { storeApi } from '../api/apiStore'
import { frontendResourceSlice } from '../store/frontend-resource/reducer'
import userReducer from '../store/user/reducer'

export const createTestStore = () =>
	configureStore({
		reducer: {
			user: userReducer,
			[storeApi.reducerPath]: storeApi.reducer,
			frontendResources: frontendResourceSlice.reducer,
		},
		middleware: getDefaultMiddleware =>
			getDefaultMiddleware({ serializableCheck: false }).concat(
				storeApi.middleware,
			),
	})
