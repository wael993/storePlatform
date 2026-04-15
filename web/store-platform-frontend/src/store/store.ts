import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { config } from '../config'
import userReducer from './user/reducer'
import { userApi } from '../api/user'
import { storePlatformApi } from '../api/storePlatformApi'
import { persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'

const persistConfig = {
	key: 'root',
	storage,
	whitelist: ['user'],
	blacklist: [userApi.reducerPath, storePlatformApi.reducerPath],
}

// Don't persist accessToken — it lives only in memory
const userPersistConfig = {
	key: 'user',
	storage,
	blacklist: ['accessToken'],
}

const rootReducer = combineReducers({
	user: persistReducer(userPersistConfig, userReducer),
	[userApi.reducerPath]: userApi.reducer,
	[storePlatformApi.reducerPath]: storePlatformApi.reducer,
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
		}).concat(userApi.middleware, storePlatformApi.middleware),
})
export default store
export type RootState = ReturnType<typeof store.getState>
