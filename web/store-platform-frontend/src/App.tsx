import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
} from 'react-router-dom'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import BarcodePage from './pages/BarcodePage'
import { UserRole } from './shared/globalEnums'
import UsersLogIn from './pages/UsersLogIn'
import AddNewTenant from './pages/AddNewTenant'
import SuperAdminLayout from './components/SuperAdminLayout'
import TenantLayout from './components/TenantLayout'
import TenantsList from './pages/TenantsList'
import ProductsPage from './pages/ProductsPage'
import OrdersPage from './pages/OrdersPage'
import InvoicesPage from './pages/InvoicesPage'
import { useAuth } from './shared/hooks/useAuth'
import { useUser } from './shared/hooks/useUser'
import { useSilentRefresh } from './shared/hooks/useSilentRefresh'
import { getEnabledActions, getTenantActions } from './shared/utils'
// import { useGetUserFrontendResourcesQuery } from './api/apiStore'
// import FullSizeLoadingSpinner from './icons/FullSizeLoadingSpinner'
// import { skipToken } from '@reduxjs/toolkit/dist/query/react'

const TENANT_ROLES = [
	UserRole.OWNER,
	UserRole.ADMIN,
	UserRole.CASHIER,
	UserRole.EMPLOYEE,
]

const App = () => {
	const { userRole } = useUser()
	const { isAuthenticated } = useAuth()

	useSilentRefresh()
	// if (!userId) return <FullSizeLoadingSpinner />

	// const {
	// 	data: frontendResources,
	// 	isLoading: isFrontendResourcesLoading,
	// 	isFetching: isFrontendResourcesFetching,
	// 	isError: isFrontendResourcesError,
	// 	error: frontendResourcesError,
	// 	// eslint-disable-next-line react-hooks/rules-of-hooks
	// } = useGetUserFrontendResourcesQuery(userId, { skip: !userId })

	const {
		isAddNewTenantEnabled,
		isTenantsListEnabled,
		isBarcodeEnabled,
		isProductsEnabled,
		isOrdersEnabled,
		isInvoicesEnabled,
		isUsersEnabled,
	} = getEnabledActions()

	const {
		isTenantAddNewTenantEnabled,
		isTenantTenantsListEnabled,
		isTenantBarcodeEnabled,
		isTenantProductsEnabled,
		isTenantOrdersEnabled,
		isTenantInvoicesEnabled,
		isTenantUsersEnabled,
	} = getTenantActions()

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
						{isBarcodeEnabled && isTenantBarcodeEnabled && (
							<Route path="/barcode" element={<BarcodePage />} />
						)}
						{isProductsEnabled && isTenantProductsEnabled && (
							<Route path="/products" element={<ProductsPage />} />
						)}
						{isOrdersEnabled && isTenantOrdersEnabled && (
							<Route path="/orders" element={<OrdersPage />} />
						)}
						{isInvoicesEnabled && isTenantInvoicesEnabled && (
							<Route path="/invoices" element={<InvoicesPage />} />
						)}
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
						{isUsersEnabled && isTenantUsersEnabled && (
							<Route path="/users" element={<UsersLogIn />} />
						)}
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
						{isInvoicesEnabled && isTenantInvoicesEnabled && (
							<Route path="/invoices" element={<InvoicesPage />} />
						)}
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
						{isAddNewTenantEnabled && isTenantAddNewTenantEnabled && (
							<Route path="/add-new-tenant" element={<AddNewTenant />} />
						)}
						{isTenantsListEnabled && isTenantTenantsListEnabled && (
							<Route path="/tenants-list" element={<TenantsList />} />
						)}
					</Route>
				</Route>

				<Route
					path="*"
					element={
						<Navigate to={isAuthenticated ? '/products' : '/login'} replace />
					}
				/>
			</Routes>
		</Router>
	)
}

export default App
