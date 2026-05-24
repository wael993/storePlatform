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
import SettingsPage from './pages/SettingsPage'
import { useAuth } from './shared/hooks/useAuth'
import { useUser } from './shared/hooks/useUser'
import { useSilentRefresh } from './shared/hooks/useSilentRefresh'
import { getEnabledActions, getTenantActions } from './shared/utils'
import { RoutePaths } from './shared/routes'
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
		isSettingsEnabled,
	} = getEnabledActions()

	const {
		isTenantAddNewTenantEnabled,
		isTenantTenantsListEnabled,
		isTenantBarcodeEnabled,
		isTenantProductsEnabled,
		isTenantOrdersEnabled,
		isTenantInvoicesEnabled,
		isTenantUsersEnabled,
		isTenantSettingsEnabled,
	} = getTenantActions()

	return (
		<Router>
			<Routes>
				<Route path={RoutePaths.LOGIN} element={<Login />} />

				{/* Tenant user routes – all wrapped in TenantLayout sidebar */}
				<Route
					element={
						<ProtectedRoute
							isAuthenticated={isAuthenticated}
							userRole={userRole}
							allowedRoles={TENANT_ROLES}
							redirectTo={RoutePaths.ADD_NEW_TENANT}
						/>
					}
				>
					<Route element={<TenantLayout />}>
						{isBarcodeEnabled && isTenantBarcodeEnabled && (
							<Route path={RoutePaths.BARCODE} element={<BarcodePage />} />
						)}
						{isProductsEnabled && isTenantProductsEnabled && (
							<>
								<Route path={RoutePaths.PRODUCTS} element={<ProductsPage />} />
								<Route
									path={RoutePaths.SINGLE_PRODUCT}
									element={<ProductsPage />}
								/>
							</>
						)}
						{isOrdersEnabled && isTenantOrdersEnabled && (
							<Route path={RoutePaths.ORDERS} element={<OrdersPage />} />
						)}
						{isInvoicesEnabled && isTenantInvoicesEnabled && (
							<Route path={RoutePaths.INVOICES} element={<InvoicesPage />} />
						)}
						{isSettingsEnabled && isTenantSettingsEnabled && (
							<Route path={RoutePaths.SETTINGS} element={<SettingsPage />} />
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
							redirectTo={RoutePaths.BARCODE}
						/>
					}
				>
					<Route element={<TenantLayout />}>
						{isUsersEnabled && isTenantUsersEnabled && (
							<Route path={RoutePaths.USERS} element={<UsersLogIn />} />
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
							redirectTo={RoutePaths.BARCODE}
						/>
					}
				>
					<Route element={<SuperAdminLayout />}>
						{isAddNewTenantEnabled && isTenantAddNewTenantEnabled && (
							<Route
								path={RoutePaths.ADD_NEW_TENANT}
								element={<AddNewTenant />}
							/>
						)}
						{isTenantsListEnabled && isTenantTenantsListEnabled && (
							<Route path={RoutePaths.TENANTS_LIST} element={<TenantsList />} />
						)}
					</Route>
				</Route>

				<Route
					path={RoutePaths.WILDCARD}
					element={
						<Navigate
							to={isAuthenticated ? RoutePaths.PRODUCTS : RoutePaths.LOGIN}
							replace
						/>
					}
				/>
			</Routes>
		</Router>
	)
}

export default App
