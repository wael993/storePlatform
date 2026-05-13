import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import EditorDashboard from './pages/EditorDashboard'
import SelectContent from './pages/SelectedContent'
import BarcodePage from './pages/BarcodePage'
import { useSilentRefresh } from './shared/useSilentRefresh'
import { UserRole } from './shared/globalEnums'
import UsersLogIn from './pages/UsersLogIn'
import AddNewTenant from './pages/AddNewTenant'
import SuperAdminLayout from './components/SuperAdminLayout'
import TenantLayout from './components/TenantLayout'
import TenantsList from './pages/TenantsList'
import ProductsPage from './pages/ProductsPage'
import OrdersPage from './pages/OrdersPage'
import InvoicesPage from './pages/InvoicesPage'
import { useUser } from './shared/useUser'
import { useAuth } from './shared/useAuth'

const TENANT_ROLES = [
	UserRole.OWNER,
	UserRole.ADMIN,
	UserRole.CASHIER,
	UserRole.EMPLOYEE,
]

const App = () => {
	const { user: userRole } = useUser()
	const { isAuthenticated } = useAuth()

	useSilentRefresh()

	return (
		<Router>
			<Routes>
				<Route path="/login" element={<Login />} />

				{/* Tenant user routes – all wrapped in TenantLayout sidebar */}
				<Route
					element={
						<ProtectedRoute
							isAuthenticated={isAuthenticated}
							userRole={userRole}
							allowedRoles={TENANT_ROLES}
							redirectTo="/add-new-tenant"
						/>
					}
				>
					<Route element={<TenantLayout />}>
						<Route path="/barcode" element={<BarcodePage />} />
						<Route path="/products" element={<ProductsPage />} />
						<Route path="/orders" element={<OrdersPage />} />
						<Route path="/dashboard" element={<EditorDashboard />} />
						<Route path="/select-content" element={<SelectContent />} />
					</Route>
				</Route>

				{/* Owner-only routes */}
				<Route
					element={
						<ProtectedRoute
							isAuthenticated={isAuthenticated}
							userRole={userRole}
							allowedRoles={[UserRole.OWNER]}
							redirectTo="/barcode"
						/>
					}
				>
					<Route element={<TenantLayout />}>
						<Route path="/users" element={<UsersLogIn />} />
					</Route>
				</Route>

				{/* Owner + Admin routes */}
				<Route
					element={
						<ProtectedRoute
							isAuthenticated={isAuthenticated}
							userRole={userRole}
							allowedRoles={[UserRole.OWNER, UserRole.ADMIN]}
							redirectTo="/barcode"
						/>
					}
				>
					<Route element={<TenantLayout />}>
						<Route path="/invoices" element={<InvoicesPage />} />
					</Route>
				</Route>

				{/* Super admin routes */}
				<Route
					element={
						<ProtectedRoute
							isAuthenticated={isAuthenticated}
							userRole={userRole}
							allowedRoles={[UserRole.SUPER_ADMIN]}
							redirectTo="/barcode"
						/>
					}
				>
					<Route element={<SuperAdminLayout />}>
						<Route path="/add-new-tenant" element={<AddNewTenant />} />
						<Route path="/tenants-list" element={<TenantsList />} />
					</Route>
				</Route>
			</Routes>
		</Router>
	)
}

export default App
