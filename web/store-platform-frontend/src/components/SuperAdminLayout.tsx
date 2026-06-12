import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
	Box,
	Button,
	Divider,
	Flex,
	Heading,
	Stack,
	Text,
} from '@chakra-ui/react'
import { useDispatch } from 'react-redux'
import { useLogoutCurrentMutation } from '../api/apiStore'
import { logout } from '../store/user/reducer'
import { getEnabledActions, getTenantActions } from '../shared/utils'
import { RoutePaths } from '../shared/routes'
import TopBar from './TopBar'
import { useUser } from '../shared/hooks/useUser'

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

const SuperAdminLayout = () => {
	const [logoutCurrent, { isLoading }] = useLogoutCurrentMutation()
	const [error, setError] = useState('')
	const dispatch = useDispatch()
	const navigate = useNavigate()
	const { user } = useUser()

	const { isAddNewTenantEnabled, isTenantsListEnabled } = getEnabledActions()
	const { isTenantAddNewTenantEnabled, isTenantTenantsListEnabled } =
		getTenantActions()

	const topBarItems = [
		isAddNewTenantEnabled && isTenantAddNewTenantEnabled
			? { label: 'Add Tenant', path: RoutePaths.ADD_NEW_TENANT }
			: null,
		isTenantsListEnabled && isTenantTenantsListEnabled
			? { label: 'Tenants List', path: RoutePaths.TENANTS_LIST }
			: null,
	].filter(Boolean) as { label: string; path: string }[]
	const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

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
			<Box
				w={{ base: 'full', md: '280px' }}
				bg="white"
				borderRightWidth="1px"
				px={5}
				py={6}
				display="flex"
				flexDir="column"
				gap={6}
			>
				<Box>
					<Text fontSize="xs" textTransform="uppercase" color="gray.500">
						Store Platform
					</Text>
					<Heading size="md" mt={1}>
						Super Admin
					</Heading>
				</Box>

				<Divider />

				<Stack gap={2}>
					{isAddNewTenantEnabled && isTenantAddNewTenantEnabled && (
						<Box as={NavLink} to={RoutePaths.ADD_NEW_TENANT} style={navStyle}>
							Add Tenant
						</Box>
					)}
					{isTenantsListEnabled && isTenantTenantsListEnabled && (
						<Box as={NavLink} to={RoutePaths.TENANTS_LIST} style={navStyle}>
							Tenants List
						</Box>
					)}
				</Stack>

				<Box mt="auto">
					{error ? (
						<Text color="red.500" fontSize="sm" mb={3}>
							{error}
						</Text>
					) : null}
					<Button
						w="full"
						colorScheme="gray"
						onClick={handleLogout}
						isLoading={isLoading}
					>
						Logout
					</Button>
				</Box>
			</Box>

			<Box flex="1" p={0}>
				<TopBar
					navItems={topBarItems}
					userName={userName || user?.email || 'User'}
					onLogout={handleLogout}
					isLogoutLoading={isLoading}
				/>
				<Box px={{ base: 4, md: 8 }} py={8}>
					<Outlet />
				</Box>
			</Box>
		</Flex>
	)
}

export default SuperAdminLayout
