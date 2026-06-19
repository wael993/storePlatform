import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Box, Flex } from '@chakra-ui/react'
import { useDispatch } from 'react-redux'
import { useLogoutCurrentMutation } from '../api/apiStore'
import { logout } from '../store/user/reducer'
import TopBar from './TopBar'
import { layout, layoutCssVars } from '../theme/layout'
import { useUser } from '../shared/hooks/useUser'

import { getEnabledActions, getTenantActions } from '../shared/utils'
import { RoutePaths } from '../shared/routes'

const TenantLayout = () => {
	const [logoutCurrent, { isLoading }] = useLogoutCurrentMutation()
	const [_error, setError] = useState('')
	const dispatch = useDispatch()
	const navigate = useNavigate()

	const { isAdmin, isOwnerOrAdmin, user } = useUser()

	const {
		isBarcodeEnabled,
		isProductsEnabled,
		isOrdersEnabled,
		isInvoicesEnabled,
		isUsersEnabled,
		isDailyEnabled,
		// isChangePasswordEnabled,
		isCustomersEnabled,
		isSuppliersEnabled,
		isPartnersEnabled,
	} = getEnabledActions()
	const {
		isTenantBarcodeEnabled,
		isTenantProductsEnabled,
		isTenantOrdersEnabled,
		isTenantInvoicesEnabled,
		isTenantUsersEnabled,
		isTenantDailyEnabled,
		// isTenantChangePasswordEnabled,
		isTenantCustomersEnabled,
		isTenantSuppliersEnabled,
		isTenantPartnersEnabled,
	} = getTenantActions()

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
		} catch (submitError: any) {
			setError(submitError?.data?.message || 'Logout failed.')
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
