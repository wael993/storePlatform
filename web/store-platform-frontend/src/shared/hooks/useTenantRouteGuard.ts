import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
	getEnabledActions,
	getTenantActions,
	isTenantRouteAllowed,
} from '../utils'
import { RoutePaths } from '../routes'

export const useTenantRouteGuard = (accessiblePages?: string[] | null) => {
	const location = useLocation()
	const navigate = useNavigate()

	useEffect(() => {
		const globalActions = getEnabledActions()
		const tenantActions = getTenantActions(accessiblePages)

		if (
			!isTenantRouteAllowed(location.pathname, globalActions, tenantActions)
		) {
			navigate(RoutePaths.ROOT, { replace: true })
		}
	}, [accessiblePages, location.pathname, navigate])
}
