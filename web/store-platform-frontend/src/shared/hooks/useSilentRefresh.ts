import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from './useAuth'
import { config } from '../../config'
import { logout, setTenantSession } from '../../store/user/reducer'
import { RootState } from '../../store/store'

const REFRESH_INTERVAL_MS = 14 * 60 * 1000 // 14 minutes (token expires at 15)
const REFRESH_BUFFER_MS = 2 * 60 * 1000 // refresh 2 minutes before expiry

const getTokenExpiryMs = (token: string): number | null => {
	try {
		const payload = token.split('.')[1]
		if (!payload) return null

		const decoded = JSON.parse(
			atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
		) as { exp?: number }

		return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null
	} catch {
		return null
	}
}

const shouldRefreshToken = (token: string | null): boolean => {
	if (!token) return true

	const expiresAtMs = getTokenExpiryMs(token)
	if (!expiresAtMs) return false

	return Date.now() >= expiresAtMs - REFRESH_BUFFER_MS
}

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
					dispatch(
						setTenantSession({
							accessToken: data.accessToken,
							accessiblePages: data.accessiblePages,
							tenantName: data.tenantName,
						}),
					)
				} else if (options?.forceLogoutOnFailure ?? !accessToken) {
					dispatch(logout())
				}
			} catch {
				if (options?.forceLogoutOnFailure ?? !accessToken) {
					dispatch(logout())
				}
			}
		}

		if (shouldRefreshToken(accessToken)) {
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
