import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { skipToken } from '@reduxjs/toolkit/query'
import {
	Box,
	Button,
	Divider,
	Flex,
	Heading,
	Stack,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import { useDispatch } from 'react-redux'
import { useLogoutCurrentMutation } from '../api/apiStore'
import { useGetUserFrontendResourcesQuery } from '../api/apiStore'
import { logout } from '../store/user/reducer'
import ChangePasswordModal from './ChangePasswordModal'
import TopBar from './TopBar'
import { useUser } from '../shared/hooks/useUser'
import { useTenant } from '../shared/hooks/useTenant'
import { getEnabledActions, getTenantActions } from '../shared/utils'
import { RoutePaths } from '../shared/routes'

const navStyle = ({ isActive }: { isActive: boolean }) => ({
	display: 'block',
	padding: '0.9rem 1rem',
	borderRadius: '0.9rem',
	fontWeight: 600,
	border: '1px solid',
	borderColor: isActive ? 'rgba(144, 205, 244, 1)' : 'transparent',
	background: isActive ? 'rgba(235, 248, 255, 1)' : 'transparent',
	color: isActive ? '#1A365D' : '#2D3748',
})

const TenantLayout = () => {
	const [logoutCurrent, { isLoading }] = useLogoutCurrentMutation()
	const [error, setError] = useState('')
	const dispatch = useDispatch()
	const navigate = useNavigate()
	const {
		isOpen: isPwOpen,
		onOpen: onPwOpen,
		onClose: onPwClose,
	} = useDisclosure()

	const { userRole, isOwner, isOwnerOrAdmin, user } = useUser()
	const { tenantName } = useTenant()
	const userId = user?.userId
	const {
		data: frontendResources,
		isLoading: isFrontendResourcesLoading,
		isFetching: isFrontendResourcesFetching,
		isError: isFrontendResourcesError,
		error: frontendResourcesError,
	} = useGetUserFrontendResourcesQuery(userId ?? skipToken)
	// console.log('🚀 ~ TenantLayout ~ frontendResources:', {
	// 	userId,
	// 	frontendResources,
	// 	isFrontendResourcesLoading,
	// 	isFrontendResourcesFetching,
	// 	isFrontendResourcesError,
	// 	frontendResourcesError,
	// })

	const {
		isBarcodeEnabled,
		isProductsEnabled,
		isOrdersEnabled,
		isInvoicesEnabled,
		isUsersEnabled,
		isDailyEnabled,
		isChangePasswordEnabled,
		isCustomersEnabled,
		isSuppliersEnabled,
	} = getEnabledActions()
	const {
		isTenantBarcodeEnabled,
		isTenantProductsEnabled,
		isTenantOrdersEnabled,
		isTenantInvoicesEnabled,
		isTenantUsersEnabled,
		isTenantDailyEnabled,
		isTenantChangePasswordEnabled,
		isTenantCustomersEnabled,
		isTenantSuppliersEnabled,
	} = getTenantActions()

	const topBarItems = [
		isDailyEnabled && isTenantDailyEnabled
			? { label: 'Daily', path: RoutePaths.DAILY }
			: null,
		isBarcodeEnabled && isTenantBarcodeEnabled
			? { label: 'Barcode', path: RoutePaths.BARCODE }
			: null,
		isOwner && isUsersEnabled && isTenantUsersEnabled
			? { label: 'Users', path: RoutePaths.USERS }
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
		<Flex minH="100vh" bg="gray.50">
			<Box flex="1" p={0}>
				<TopBar navItems={topBarItems} />
				<Box px={{ base: 4, md: 8 }} py={8}>
					<Outlet />
				</Box>
			</Box>

			{/* <ChangePasswordModal isOpen={isPwOpen} onClose={onPwClose} /> */}
		</Flex>
	)
}

export default TenantLayout
