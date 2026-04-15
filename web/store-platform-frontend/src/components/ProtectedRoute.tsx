import { Navigate, Outlet } from 'react-router-dom'

type ProtectedRouteProps = {
	isAuthenticated: boolean
}

const ProtectedRoute = ({ isAuthenticated }: ProtectedRouteProps) => {
	if (!isAuthenticated) {
		return <Navigate to="/login" />
	}

	return <Outlet />
}

export default ProtectedRoute
