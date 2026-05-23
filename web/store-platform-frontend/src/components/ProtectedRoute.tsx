import { Navigate, Outlet } from 'react-router-dom'
import { UserRole } from '../shared/globalEnums'
import { RoutePaths } from '../shared/routes'

type ProtectedRouteProps = {
	isAuthenticated: boolean
	userRole?: UserRole | null
	allowedRoles?: UserRole[]
	redirectTo?: string
}

const ProtectedRoute = ({
	isAuthenticated,
	userRole,
	allowedRoles,
	redirectTo = RoutePaths.BARCODE,
}: ProtectedRouteProps) => {
	if (!isAuthenticated) {
		return <Navigate to={RoutePaths.LOGIN} />
	}

	if (
		allowedRoles &&
		allowedRoles.length > 0 &&
		(!userRole || !allowedRoles.includes(userRole))
	) {
		return <Navigate to={redirectTo} replace />
	}

	return <Outlet />
}

export default ProtectedRoute
