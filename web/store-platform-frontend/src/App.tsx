import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import EditorDashboard from './pages/EditorDashboard'
import SelectContent from './pages/SelectedContent'
import BarcodePage from './pages/BarcodePage'
import { useSelector } from 'react-redux'
import { RootState } from './store/store'
import { useSilentRefresh } from './shared/useSilentRefresh'
import { UserRole } from './shared/globalEnums'
import UsersLogIn from './pages/UsersLogIn'

const App = () => {
	const isAuthenticated = useSelector(
		(state: RootState) => state.user.isAuthenticated,
	)
	const userRole = useSelector(
		(state: RootState) => state.user.user?.role ?? null,
	)
	useSilentRefresh()

	return (
		<Router>
			<Routes>
				<Route path="/login" element={<Login />} />

				{/* Protected routes */}
				<Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
					<Route path="/" element={<Home />} />
					<Route path="/barcode" element={<BarcodePage />} />
					<Route path="/dashboard" element={<EditorDashboard />} />
					<Route path="/select-content" element={<SelectContent />} />
				</Route>

				<Route
					element={
						<ProtectedRoute
							isAuthenticated={isAuthenticated}
							userRole={userRole}
							allowedRoles={[UserRole.OWNER, UserRole.ADMIN]}
						/>
					}
				>
					{/* <Route path="/admin" element={<Dashboard />} /> */}
					<Route path="/users-login" element={<UsersLogIn />} />
				</Route>
			</Routes>
		</Router>
	)
}

export default App
