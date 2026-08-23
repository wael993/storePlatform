import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
	getEnabledActions,
	getTenantActions,
	isTenantRouteAllowed,
	tenantHomePath,
} from '../utils'
import { RoutePaths } from '../routes'
import { useSee } from './useSee'

export const useTenantRouteGuard = (accessiblePages?: string[] | null) => {
	const location = useLocation()
	const navigate = useNavigate()
	const { canSee } = useSee()

	useEffect(() => {
		const globalActions = getEnabledActions()
		const tenantActions = getTenantActions(accessiblePages)

		if (
			!isTenantRouteAllowed(
				location.pathname,
				globalActions,
				tenantActions,
				canSee,
			)
		) {
			const home = tenantHomePath(canSee)
			if (location.pathname !== home && location.pathname !== RoutePaths.ROOT) {
				navigate(home, { replace: true })
				return
			}

			if (
				location.pathname === RoutePaths.ROOT ||
				location.pathname === RoutePaths.STORE_PLATFORM
			) {
				if (home !== RoutePaths.ROOT) {
					navigate(home, { replace: true })
				}
			}
		}
	}, [accessiblePages, canSee, location.pathname, navigate])
}
