import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from './useAuth'
import { config } from '../../config'
import { logout, setAccessToken } from '../../store/user/reducer'
import { RootState } from '../../store/store'

const REFRESH_INTERVAL_MS = 14 * 60 * 1000 // 14 minutes (token expires at 15)

export function useSilentRefresh() {
	const dispatch = useDispatch()
	const { isAuthenticated } = useAuth()
	const accessToken = useSelector((state: RootState) => state.user.accessToken)

	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(() => {
		if (!isAuthenticated) {
			if (intervalRef.current) clearInterval(intervalRef.current)
			return
		}

		const refreshToken = async (options?: {
			forceLogoutOnFailure?: boolean
		}) => {
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
				} else if (options?.forceLogoutOnFailure ?? !accessToken) {
					dispatch(logout())
				}
			} catch {
				if (options?.forceLogoutOnFailure ?? !accessToken) {
					dispatch(logout())
				}
			}
		}

		// Skip immediate refresh after login when access token is already in memory
		if (!accessToken) {
			refreshToken()
		}

		intervalRef.current = setInterval(
			() => refreshToken({ forceLogoutOnFailure: true }),
			REFRESH_INTERVAL_MS,
		)

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current)
		}
	}, [isAuthenticated, accessToken, dispatch])
}
