import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import EditorDashboard from './pages/EditorDashboard'
import UsersLogIn from './pages/UsersLogIn'
import SelectContent from './pages/SelectedContent'
import BarcodePage from './pages/BarcodePage'
import { useSelector } from 'react-redux'
import { RootState } from './store/store'
import { useSilentRefresh } from './shared/useSilentRefresh'

const App = () => {
	const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated)
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
					<Route path="/users-login" element={<UsersLogIn />} />
					<Route path="/admin" element={<Dashboard />} />
				</Route>
			</Routes>
		</Router>
	)
}

export default App
