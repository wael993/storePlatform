import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AuthState {
	user: LoginAPI | null
	token: string | null
}

const initialState: AuthState = {
	user: null,
	token: localStorage.getItem('token'),
}

const authSlice = createSlice({
	name: 'auth',
	initialState,
	reducers: {
		setCredentials: (state, action: PayloadAction<LoginAPI>) => {
			state.user = action.payload
			state.token = action.payload.token
		},
		logout: state => {
			state.user = null
			state.token = null
			localStorage.removeItem('token')
			localStorage.removeItem('role')
		},
	},
})

export const { setCredentials, logout } = authSlice.actions
export default authSlice.reducer
