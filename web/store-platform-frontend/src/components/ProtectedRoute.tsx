import { Navigate, Outlet } from 'react-router-dom'
import { UserRole } from '../shared/globalEnums'

type ProtectedRouteProps = {
	isAuthenticated: boolean
	userRole?: UserRole | null
	allowedRoles?: UserRole[]
}

const ProtectedRoute = ({
	isAuthenticated,
	userRole,
	allowedRoles,
}: ProtectedRouteProps) => {
	if (!isAuthenticated) {
		return <Navigate to="/login" />
	}

	if (
		allowedRoles &&
		allowedRoles.length > 0 &&
		(!userRole || !allowedRoles.includes(userRole))
	) {
		return <Navigate to="/barcode" replace />
	}

	return <Outlet />
}

export default ProtectedRoute
