import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { config } from '../config'
import userReducer from './user/reducer'
import { storeApi } from '../api/apiStore'
import { persistReducer, persistStore } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import { frontendResourceSlice } from './frontend-resource/reducer'

const persistConfig = {
	key: 'root',
	storage,
	whitelist: ['user'],
	blacklist: [storeApi.reducerPath],
}

// Don't persist accessToken — it lives only in memory
const userPersistConfig = {
	key: 'user',
	storage,
	blacklist: ['accessToken'],
}

const rootReducer = combineReducers({
	user: persistReducer(userPersistConfig, userReducer),
	[storeApi.reducerPath]: storeApi.reducer,
	frontendResources: frontendResourceSlice.reducer,
})

type RootReducerState = ReturnType<typeof rootReducer>
const persistedReducer = persistReducer<RootReducerState>(
	persistConfig,
	rootReducer,
)
const store = configureStore({
	devTools: { name: config.serviceId },
	reducer: persistedReducer,
	middleware: getDefaultMiddleware =>
		getDefaultMiddleware({
			serializableCheck: false,
		}).concat(storeApi.middleware),
})

export const persistor = persistStore(store)
setupListeners(store.dispatch)
export default store
export type RootState = ReturnType<typeof store.getState>
