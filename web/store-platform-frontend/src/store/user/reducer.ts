import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { onAuthLogout } from '../../offline/offlineTenantAccess'

interface AuthState {
	user: Omit<LoginAPI, 'accessToken'> | null
	accessToken: string | null
	isAuthenticated: boolean
}

const initialState: AuthState = {
	user: null,
	accessToken: null,
	isAuthenticated: false,
}

const authSlice = createSlice({
	name: 'auth',
	initialState,
	reducers: {
		setCredentials: (state, action: PayloadAction<LoginAPI>) => {
			const {
				accessToken,
				offlineEnabled: _offlineEnabled,
				...userData
			} = action.payload
			state.user = userData
			state.accessToken = accessToken
			state.isAuthenticated = true
		},
		setAccessToken: (state, action: PayloadAction<string>) => {
			state.accessToken = action.payload
		},
		setTenantSession: (
			state,
			action: PayloadAction<{
				accessToken?: string
				accessiblePages?: string[]
				tenantName?: string
			}>,
		) => {
			if (action.payload.accessToken) {
				state.accessToken = action.payload.accessToken
			}

			if (state.user) {
				if (action.payload.accessiblePages) {
					state.user.accessiblePages = action.payload.accessiblePages
				}

				if (action.payload.tenantName) {
					state.user.tenantName = action.payload.tenantName
				}
			}
		},
		logout: state => {
			onAuthLogout()
			state.user = null
			state.accessToken = null
			state.isAuthenticated = false
		},
	},
})

export const { setCredentials, setAccessToken, setTenantSession, logout } =
	authSlice.actions
export default authSlice.reducer
