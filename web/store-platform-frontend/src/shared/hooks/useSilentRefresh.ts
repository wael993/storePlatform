import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from './useAuth'
import { config } from '../../config'
import { getIsNetworkOnline } from '../../offline/connectivity'
import { getWorkMode } from '../../offline/workMode'
import {
	hasValidOfflineSession,
	loadTenantOfflineConfig,
	setTenantOfflineConfig,
} from '../../offline/offlineTenantAccess'
import { initOfflineState } from '../../offline/syncService'
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
	const tenantId = useSelector((state: RootState) => state.user.user?.tenantId)

	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(() => {
		if (!isAuthenticated) {
			if (intervalRef.current) clearInterval(intervalRef.current)
			return
		}

		const shouldLogoutOnRefreshFailure = async (options?: {
			forceLogoutOnFailure?: boolean
		}): Promise<boolean> => {
			if (!tenantId) {
				return options?.forceLogoutOnFailure ?? !accessToken
			}

			const hasOfflineSession = await hasValidOfflineSession(tenantId)

			if (!getIsNetworkOnline() && hasOfflineSession) {
				return false
			}

			if (hasOfflineSession && !options?.forceLogoutOnFailure) {
				return false
			}

			return options?.forceLogoutOnFailure ?? !accessToken
		}

		const refreshToken = async (options?: {
			forceLogoutOnFailure?: boolean
		}) => {
			if (getWorkMode() === 'offline') return

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
					await setTenantOfflineConfig(data.tenantId, data.offlineEnabled)
					dispatch(
						setTenantSession({
							accessToken: data.accessToken,
							accessiblePages: data.accessiblePages,
							tenantName: data.tenantName,
						}),
					)
				} else if (await shouldLogoutOnRefreshFailure(options)) {
					dispatch(logout())
				}
			} catch {
				if (await shouldLogoutOnRefreshFailure(options)) {
					dispatch(logout())
				}
			}
		}

		const initializeSession = async () => {
			if (tenantId) {
				await loadTenantOfflineConfig(tenantId)
				await initOfflineState(tenantId)
			}

			if (shouldRefreshToken(accessToken)) {
				await refreshToken()
			}
		}

		void initializeSession()

		intervalRef.current = setInterval(
			() => refreshToken({ forceLogoutOnFailure: true }),
			REFRESH_INTERVAL_MS,
		)

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current)
		}
	}, [isAuthenticated, accessToken, tenantId, dispatch])
}
