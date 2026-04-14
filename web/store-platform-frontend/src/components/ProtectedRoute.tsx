import { Navigate, Outlet } from 'react-router-dom'

type ProtectedRouteProps = {
	token: string | null
}

const ProtectedRoute = ({ token }: ProtectedRouteProps) => {
	if (!token) {
		return <Navigate to="/login" />
	}

	return <Outlet />
}

export default ProtectedRoute
