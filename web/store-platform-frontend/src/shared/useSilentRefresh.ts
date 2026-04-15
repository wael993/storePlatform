import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../store/store'
import { setAccessToken, logout } from '../store/user/reducer'
import { config } from '../config'

const REFRESH_INTERVAL_MS = 14 * 60 * 1000 // 14 minutes (token expires at 15)

export function useSilentRefresh() {
	const dispatch = useDispatch()
	const isAuthenticated = useSelector(
		(state: RootState) => state.user.isAuthenticated,
	)
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(() => {
		if (!isAuthenticated) {
			if (intervalRef.current) clearInterval(intervalRef.current)
			return
		}

		const refreshToken = async () => {
			try {
				const res = await fetch(
					`${config.endpoints.storePlatformEndpoint}/refresh`,
					{
						method: 'POST',
						credentials: 'include',
					},
				)

				if (res.ok) {
					const data = await res.json()
					dispatch(setAccessToken(data.accessToken))
				} else {
					dispatch(logout())
				}
			} catch {
				dispatch(logout())
			}
		}

		// Refresh immediately on mount (e.g. page reload while authenticated)
		refreshToken()

		intervalRef.current = setInterval(refreshToken, REFRESH_INTERVAL_MS)

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current)
		}
	}, [isAuthenticated, dispatch])
}
