import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
} from 'react-router-dom'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import { TargetType, UserRole } from './shared/globalEnums'
import UsersLogIn from './pages/UsersLogIn'
import AddNewTenant from './pages/AddNewTenant'
import SuperAdminLayout from './components/SuperAdminLayout'
import TenantLayout from './components/TenantLayout'
import TenantsList from './pages/TenantsList'
import RenewalRequestsPage from './pages/RenewalRequestsPage'
import ProductsPage from './components/product/ProductsPage'
import OrdersPage from './pages/OrdersPage'
import SettingsPage from './pages/SettingsPage'
import WelcomePage from './pages/WelcomePage'
import { useAuth } from './shared/hooks/useAuth'
import { useUser } from './shared/hooks/useUser'
import { useSee } from './shared/hooks/useSee'
import { SEE } from './shared/seeFlags'
import { useSilentRefresh } from './shared/hooks/useSilentRefresh'
import { getEnabledActions, getTenantActions } from './shared/utils'
import { RoutePaths } from './shared/routes'
import SupplierPage from './components/supplier/SupplierPage'
import CustomerPage from './components/customer/CustomerPage'
import PartnerPage from './components/partner/PartnerPage'
import DailyPage from './components/daily/DailyPage'
import CustomerModal from './components/customer/CustomerModal'
import CategoryPage from './components/category/CategoryPage'
import SupplierModal from './components/supplier/SupplierModal'
import PartnerModal from './components/partner/PartnerModal'
import ProductModal from './components/product/ProductModal'
import SellingInvoicesPage from './components/SellingInvoice/SellingInvoicesPage'
import EmployeesPage from './components/employee/EmployeesPage'
import EmployeeProfilePage from './components/employee/EmployeeProfilePage'
import ReportPage from './pages/ReportPage'

const TENANT_ROLES = [
	UserRole.OWNER,
	UserRole.ADMIN,
	UserRole.CASHIER,
	UserRole.EMPLOYEE,
]

const App = () => {
	const { userRole, user } = useUser()
	const { canSee, canSeeAny } = useSee()
	const { isAuthenticated } = useAuth()

	useSilentRefresh()

	const enabledActions = getEnabledActions()
	const tenantActions = getTenantActions(user?.accessiblePages)

	const {
		isAddNewTenantEnabled,
		isTenantsListEnabled,
		isDailyEnabled,
		isProductsEnabled,
		isOrdersEnabled,
		isSellingInvoicesEnabled,
		isReportsEnabled,
		isUsersEnabled,
		isEmployeesEnabled,
		isSettingsEnabled,
		isCustomersEnabled,
		isCategoriesEnabled,
		isSuppliersEnabled,
		isPartnersEnabled,
	} = enabledActions

	const {
		isTenantAddNewTenantEnabled,
		isTenantTenantsListEnabled,
		isTenantProductsEnabled,
		isTenantDailyEnabled,
		isTenantOrdersEnabled,
		isTenantSellingInvoicesEnabled,
		isTenantReportsEnabled,
		isTenantUsersEnabled,
		isTenantEmployeesEnabled,
		isTenantSettingsEnabled,
		isTenantCustomersEnabled,
		isTenantCategoriesEnabled,
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
						{isProductsEnabled &&
							isTenantProductsEnabled &&
							canSee(SEE.products) && (
								<Route
									path={RoutePaths.PRODUCTS}
									element={<ProductsPage targetType={TargetType.PRODUCT} />}
								>
									<Route
										path=":productId"
										element={<ProductModal targetType={TargetType.PRODUCT} />}
									/>
								</Route>
							)}
						{isOrdersEnabled && isTenantOrdersEnabled && canSee(SEE.orders) && (
							<Route path={RoutePaths.ORDERS} element={<OrdersPage />} />
						)}

						{isDailyEnabled && isTenantDailyEnabled && canSee(SEE.daily) && (
							<Route
								path={RoutePaths.DAILY}
								element={<DailyPage targetType={TargetType.DAILY_ACTION} />}
							/>
						)}

						{isSellingInvoicesEnabled &&
							isTenantSellingInvoicesEnabled &&
							canSee(SEE.invoices) && (
								<Route
									path={RoutePaths.SELLING_INVOICES}
									element={<SellingInvoicesPage />}
								/>
							)}
						{isReportsEnabled &&
							isTenantReportsEnabled &&
							canSee(SEE.reports) && (
								<Route path={RoutePaths.REPORTS} element={<ReportPage />} />
							)}
						{isSettingsEnabled &&
							isTenantSettingsEnabled &&
							canSee(SEE.settings) && (
								<Route path={RoutePaths.SETTINGS} element={<SettingsPage />} />
							)}
						{isCustomersEnabled &&
							isTenantCustomersEnabled &&
							canSee(SEE.customers) && (
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
						{isCategoriesEnabled &&
							isTenantCategoriesEnabled &&
							canSee(SEE.categories) && (
								<Route
									path={RoutePaths.CATEGORIES}
									element={<CategoryPage targetType={TargetType.CATEGORY} />}
								/>
							)}
						{isSuppliersEnabled &&
							isTenantSuppliersEnabled &&
							canSee(SEE.supplier) && (
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
						{isPartnersEnabled &&
							isTenantPartnersEnabled &&
							canSee(SEE.partners) && (
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
						{isEmployeesEnabled &&
							isTenantEmployeesEnabled &&
							canSee(SEE.employees) && (
								<>
									<Route
										path={RoutePaths.EMPLOYEES}
										element={<EmployeesPage />}
									/>
									<Route
										path={RoutePaths.SINGLE_EMPLOYEE}
										element={<EmployeeProfilePage />}
									/>
								</>
							)}
						{isUsersEnabled &&
							isTenantUsersEnabled &&
							canSeeAny([SEE.usersInvite, SEE.usersList]) && (
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
							redirectTo={RoutePaths.ROOT}
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
							<>
								<Route
									path={RoutePaths.TENANTS_LIST}
									element={<TenantsList />}
								/>
								<Route
									path={RoutePaths.RENEWAL_REQUESTS}
									element={<RenewalRequestsPage />}
								/>
							</>
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
