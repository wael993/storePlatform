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

const App = () => {
	// const token = localStorage.getItem('token')
	const token = useSelector((state: RootState) => state.user.token)
	return (
		<Router>
			<Routes>
				<Route path="/login" element={<Login />} />

				{/* Protected routes */}
				<Route element={<ProtectedRoute token={token} />}>
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
