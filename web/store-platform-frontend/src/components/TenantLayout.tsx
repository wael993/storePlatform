import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Box, Flex } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useLogoutCurrentMutation } from '../api/apiStore'
import { logout } from '../store/user/reducer'
import TopBar from './TopBar'
import { layout, layoutCssVars } from '../theme/layout'
import { useUser } from '../shared/hooks/useUser'
import { useSee } from '../shared/hooks/useSee'
import { SEE } from '../shared/seeFlags'
import { useTenantRouteGuard } from '../shared/hooks/useTenantRouteGuard'
import { useProductCatalogSync } from '../shared/hooks/useProductCatalogSync'

import { getEnabledActions, getTenantActions } from '../shared/utils'
import { RoutePaths } from '../shared/routes'
import OfflineSyncBanner from './OfflineSyncBanner'
import SubscriptionRenewalBanner from './SubscriptionRenewalBanner'
import { getOfflineState } from '../offline/syncService'
import ProductImportGate from './productImport/ProductImportGate'

const TenantLayout = () => {
	const { t } = useTranslation()
	const [logoutCurrent, { isLoading }] = useLogoutCurrentMutation()
	const [_error, setError] = useState('')
	const dispatch = useDispatch()
	const navigate = useNavigate()

	const { user } = useUser()
	const { canSee, canSeeAny } = useSee()

	useTenantRouteGuard(user?.accessiblePages)
	useProductCatalogSync()

	const [showImportProducts, setShowImportProducts] = useState(false)
	const [importWizardSignal, setImportWizardSignal] = useState(0)

	const enabledActions = getEnabledActions()
	const tenantActions = getTenantActions(user?.accessiblePages)
	const isSettingsVisible =
		enabledActions.isSettingsEnabled &&
		tenantActions.isTenantSettingsEnabled &&
		canSee(SEE.settings)

	const {
		isProductsEnabled,
		isOrdersEnabled,
		isUsersEnabled,
		isDailyEnabled,
		isCustomersEnabled,
		isSellingInvoicesEnabled,
		isReportsEnabled,
		isCategoriesEnabled,
		isSuppliersEnabled,
		isPartnersEnabled,
		isEmployeesEnabled,
	} = enabledActions

	const {
		isTenantProductsEnabled,
		isTenantOrdersEnabled,
		isTenantUsersEnabled,
		isTenantDailyEnabled,
		isTenantCustomersEnabled,
		isTenantSellingInvoicesEnabled,
		isTenantReportsEnabled,
		isTenantCategoriesEnabled,
		isTenantSuppliersEnabled,
		isTenantPartnersEnabled,
		isTenantEmployeesEnabled,
	} = tenantActions

	const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

	const topBarItems = [
		canSee(SEE.welcome) ? { label: 'Welcome', path: RoutePaths.ROOT } : null,
		isDailyEnabled && isTenantDailyEnabled && canSee(SEE.daily)
			? { label: 'Daily', path: RoutePaths.DAILY }
			: null,
		isProductsEnabled && isTenantProductsEnabled && canSee(SEE.products)
			? { label: 'Products', path: RoutePaths.PRODUCTS }
			: null,
		isOrdersEnabled && isTenantOrdersEnabled && canSee(SEE.orders)
			? { label: 'Orders', path: RoutePaths.ORDERS }
			: null,
		isCustomersEnabled && isTenantCustomersEnabled && canSee(SEE.customers)
			? { label: 'Customers', path: RoutePaths.CUSTOMERS }
			: null,
		isSuppliersEnabled && isTenantSuppliersEnabled && canSee(SEE.supplier)
			? { label: 'Suppliers', path: RoutePaths.SUPPLIERS }
			: null,
		isSellingInvoicesEnabled &&
		isTenantSellingInvoicesEnabled &&
		canSee(SEE.invoices)
			? { label: 'Selling Invoices', path: RoutePaths.SELLING_INVOICES }
			: null,
		isReportsEnabled && isTenantReportsEnabled && canSee(SEE.reports)
			? { label: 'Reports', path: RoutePaths.REPORTS }
			: null,
		isCategoriesEnabled && isTenantCategoriesEnabled && canSee(SEE.categories)
			? { label: 'Categories', path: RoutePaths.CATEGORIES }
			: null,
		isPartnersEnabled && isTenantPartnersEnabled && canSee(SEE.partners)
			? { label: 'Partners', path: RoutePaths.PARTNERS }
			: null,
		isEmployeesEnabled && isTenantEmployeesEnabled && canSee(SEE.employees)
			? { label: 'Employees', path: RoutePaths.EMPLOYEES }
			: null,
		isUsersEnabled &&
		isTenantUsersEnabled &&
		canSeeAny([SEE.usersInvite, SEE.usersList])
			? { label: 'Users', path: RoutePaths.USERS }
			: null,
	].filter(Boolean) as { label: string; path: string }[]

	const handleLogout = async () => {
		const { pendingCount } = getOfflineState()
		if (pendingCount > 0) {
			// TODO: Show a modal instead of a confirm dialog ي
			const confirmed = window.confirm(t('offline.unsyncedLogoutWarning'))
			if (!confirmed) return
		}

		setError('')
		try {
			await logoutCurrent().unwrap()
		} catch (error) {
			const err = error as { data?: { message?: string } }
			setError(err?.data?.message || 'Logout failed.')
		} finally {
			dispatch(logout())
			navigate(RoutePaths.LOGIN, { replace: true })
		}
	}

	return (
		<Flex minH="100dvh" bg="gray.50" overflowX="hidden">
			<Box flex="1" p={0} minW={0} sx={layoutCssVars}>
				<TopBar
					navItems={topBarItems}
					userName={userName || user?.email || 'User'}
					onLogout={handleLogout}
					isLogoutLoading={isLoading}
					isSettingsVisible={isSettingsVisible}
					showImportProducts={showImportProducts}
					onImportProducts={() => setImportWizardSignal(value => value + 1)}
				/>
				<ProductImportGate
					onLaterChange={setShowImportProducts}
					openWizardSignal={importWizardSignal}
				/>
				<SubscriptionRenewalBanner />
				<OfflineSyncBanner />
				<Box
					px={layout.contentPaddingX}
					py={layout.contentPaddingY}
					minW={0}
					maxW="100%"
				>
					<Outlet />
				</Box>
			</Box>
		</Flex>
	)
}

export default TenantLayout
