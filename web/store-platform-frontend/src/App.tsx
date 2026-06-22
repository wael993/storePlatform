import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
} from 'react-router-dom'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import BarcodePage from './pages/BarcodePage'
import { TargetType, UserRole } from './shared/globalEnums'
import UsersLogIn from './pages/UsersLogIn'
import AddNewTenant from './pages/AddNewTenant'
import SuperAdminLayout from './components/SuperAdminLayout'
import TenantLayout from './components/TenantLayout'
import TenantsList from './pages/TenantsList'
import ProductsPage from './components/product/ProductsPage'
import OrdersPage from './pages/OrdersPage'
import InvoicesPage from './pages/InvoicesPage'
import SettingsPage from './pages/SettingsPage'
import WelcomePage from './pages/WelcomePage'
import { useAuth } from './shared/hooks/useAuth'
import { useUser } from './shared/hooks/useUser'
import { useSilentRefresh } from './shared/hooks/useSilentRefresh'
import { getEnabledActions, getTenantActions } from './shared/utils'
import { RoutePaths } from './shared/routes'

import SupplierPage from './components/supplier/SupplierPage'
import CustomerPage from './components/customer/CustomerPage'
import PartnerPage from './components/partner/PartnerPage'
import DailyPage from './components/daily/DailyPage'
import CustomerModal from './components/customer/CustomerModal'
import SupplierModal from './components/supplier/SupplierModal'
import PartnerModal from './components/partner/PartnerModal'
import ProductModal from './components/product/ProductModal'

const TENANT_ROLES = [
	UserRole.OWNER,
	UserRole.ADMIN,
	UserRole.CASHIER,
	UserRole.EMPLOYEE,
]

const App = () => {
	const { userRole, user } = useUser()
	const { isAuthenticated } = useAuth()

	useSilentRefresh()

	const enabledActions = getEnabledActions()
	const tenantActions = getTenantActions(user?.accessiblePages)

	const {
		isAddNewTenantEnabled,
		isTenantsListEnabled,
		isBarcodeEnabled,
		isDailyEnabled,
		isProductsEnabled,
		isOrdersEnabled,
		isInvoicesEnabled,
		isUsersEnabled,
		isSettingsEnabled,
		isCustomersEnabled,
		isSuppliersEnabled,
		isPartnersEnabled,
	} = enabledActions

	const {
		isTenantAddNewTenantEnabled,
		isTenantTenantsListEnabled,
		isTenantBarcodeEnabled,
		isTenantProductsEnabled,
		isTenantDailyEnabled,
		isTenantOrdersEnabled,
		isTenantInvoicesEnabled,
		isTenantUsersEnabled,
		isTenantSettingsEnabled,
		isTenantCustomersEnabled,
		isTenantSuppliersEnabled,
		isTenantPartnersEnabled,
	} = tenantActions

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
						<Route path={RoutePaths.ROOT} element={<WelcomePage />} />
						<Route path={RoutePaths.STORE_PLATFORM} element={<WelcomePage />} />
						{isBarcodeEnabled && isTenantBarcodeEnabled && (
							<Route path={RoutePaths.BARCODE} element={<BarcodePage />} />
						)}
						{isProductsEnabled && isTenantProductsEnabled && (
							<>
								<Route
									path={RoutePaths.PRODUCTS}
									element={<ProductsPage targetType={TargetType.PRODUCT} />}
								/>
								<Route
									path={RoutePaths.SINGLE_PRODUCT}
									element={<ProductModal targetType={TargetType.PRODUCT} />}
								/>
							</>
						)}
						{isOrdersEnabled && isTenantOrdersEnabled && (
							<Route path={RoutePaths.ORDERS} element={<OrdersPage />} />
						)}

						{isDailyEnabled && isTenantDailyEnabled && (
							<Route
								path={RoutePaths.DAILY}
								element={<DailyPage targetType={TargetType.DAILY_ACTION} />}
							/>
						)}

						{isInvoicesEnabled && isTenantInvoicesEnabled && (
							<Route path={RoutePaths.INVOICES} element={<InvoicesPage />} />
						)}
						{isSettingsEnabled && isTenantSettingsEnabled && (
							<Route path={RoutePaths.SETTINGS} element={<SettingsPage />} />
						)}
						{isCustomersEnabled && isTenantCustomersEnabled && (
							<>
								<Route
									path={RoutePaths.CUSTOMERS}
									element={<CustomerPage targetType={TargetType.CUSTOMER} />}
								/>
								<Route
									path={RoutePaths.SINGLE_CUSTOMER}
									element={<CustomerModal targetType={TargetType.CUSTOMER} />}
								/>
							</>
						)}
						{isSuppliersEnabled && isTenantSuppliersEnabled && (
							<>
								<Route
									path={RoutePaths.SUPPLIERS}
									element={<SupplierPage targetType={TargetType.SUPPLIER} />}
								/>
								<Route
									path={RoutePaths.SINGLE_SUPPLIER}
									element={<SupplierModal targetType={TargetType.SUPPLIER} />}
								/>
							</>
						)}
						{isPartnersEnabled && isTenantPartnersEnabled && (
							<>
								<Route
									path={RoutePaths.PARTNERS}
									element={<PartnerPage targetType={TargetType.PARTNER} />}
								/>
								<Route
									path={RoutePaths.SINGLE_PARTNER}
									element={<PartnerModal targetType={TargetType.PARTNER} />}
								/>
							</>
						)}
					</Route>
				</Route>

				{/* Admin-only routes */}
				<Route
					element={
						<ProtectedRoute
							isAuthenticated={isAuthenticated}
							userRole={userRole}
							allowedRoles={[UserRole.ADMIN]}
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
							to={isAuthenticated ? RoutePaths.ROOT : RoutePaths.LOGIN}
							replace
						/>
					}
				/>
			</Routes>
		</Router>
	)
}

export default App
