import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Box, Flex } from '@chakra-ui/react'
import { useDispatch } from 'react-redux'
import { useLogoutCurrentMutation } from '../api/apiStore'
import { logout } from '../store/user/reducer'
import TopBar from './TopBar'
import { layout, layoutCssVars } from '../theme/layout'
import { useUser } from '../shared/hooks/useUser'
import { useTenantRouteGuard } from '../shared/hooks/useTenantRouteGuard'

import { getEnabledActions, getTenantActions } from '../shared/utils'
import { RoutePaths } from '../shared/routes'

const TenantLayout = () => {
	const [logoutCurrent, { isLoading }] = useLogoutCurrentMutation()
	const [_error, setError] = useState('')
	const dispatch = useDispatch()
	const navigate = useNavigate()

	const { isAdmin, isOwnerOrAdmin, user } = useUser()
	console.log('🚀 ~ TenantLayout ~ user:', user)
	useTenantRouteGuard(user?.accessiblePages)

	const enabledActions = getEnabledActions()
	const tenantActions = getTenantActions(user?.accessiblePages)
	const isSettingsVisible =
		enabledActions.isSettingsEnabled && tenantActions.isTenantSettingsEnabled

	const {
		isBarcodeEnabled,
		isProductsEnabled,
		isOrdersEnabled,
		isInvoicesEnabled,
		isUsersEnabled,
		isDailyEnabled,
		isCustomersEnabled,
		isCategoriesEnabled,
		isSuppliersEnabled,
		isPartnersEnabled,
	} = enabledActions

	const {
		isTenantBarcodeEnabled,
		isTenantProductsEnabled,
		isTenantOrdersEnabled,
		isTenantInvoicesEnabled,
		isTenantUsersEnabled,
		isTenantDailyEnabled,
		isTenantCustomersEnabled,
		isTenantCategoriesEnabled,
		isTenantSuppliersEnabled,
		isTenantPartnersEnabled,
	} = tenantActions

	const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

	const topBarItems = [
		{ label: 'Welcome', path: RoutePaths.ROOT },
		isDailyEnabled && isTenantDailyEnabled
			? { label: 'Daily', path: RoutePaths.DAILY }
			: null,
		isBarcodeEnabled && isTenantBarcodeEnabled
			? { label: 'Barcode', path: RoutePaths.BARCODE }
			: null,
		isProductsEnabled && isTenantProductsEnabled
			? { label: 'Products', path: RoutePaths.PRODUCTS }
			: null,
		isOrdersEnabled && isTenantOrdersEnabled
			? { label: 'Orders', path: RoutePaths.ORDERS }
			: null,
		isOwnerOrAdmin && isInvoicesEnabled && isTenantInvoicesEnabled
			? { label: 'Invoices', path: RoutePaths.INVOICES }
			: null,
		isCustomersEnabled && isTenantCustomersEnabled
			? { label: 'Customers', path: RoutePaths.CUSTOMERS }
			: null,
		isCategoriesEnabled && isTenantCategoriesEnabled
			? { label: 'Categories', path: RoutePaths.CATEGORIES }
			: null,
		isSuppliersEnabled && isTenantSuppliersEnabled
			? { label: 'Suppliers', path: RoutePaths.SUPPLIERS }
			: null,
		isPartnersEnabled && isTenantPartnersEnabled
			? { label: 'Partners', path: RoutePaths.PARTNERS }
			: null,
		isAdmin && isUsersEnabled && isTenantUsersEnabled
			? { label: 'Users', path: RoutePaths.USERS }
			: null,
	].filter(Boolean) as { label: string; path: string }[]

	const handleLogout = async () => {
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
				/>
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
