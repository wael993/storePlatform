import { useMemo, useState } from 'react'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	AlertTitle,
	// Badge,
	Box,
	Button,
	// Checkbox,
	Container,
	Flex,
	FormControl,
	FormLabel,
	Heading,
	Input,
	Select,
	SimpleGrid,
	Spinner,
	Stack,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from '@chakra-ui/react'
import { BreadCrumbItem, UserRole } from '../shared/globalEnums'
import {
	useDeleteTenantUserMutation,
	useGetTenantUsersQuery,
	useInviteTenantUserMutation,
	useUpdateTenantUserMutation,
} from '../api/apiStore'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { generateBreadcrumbs } from '../shared/routes'

const USER_ROLE_OPTIONS: UserRole[] = [
	UserRole.OWNER,
	UserRole.ADMIN,
	UserRole.CASHIER,
	UserRole.EMPLOYEE,
]

const UsersLogIn = () => {
	const breadCrumbItems = generateBreadcrumbs()
	const { data: users = [], isLoading, isFetching } = useGetTenantUsersQuery()
	const [inviteTenantUser, { isLoading: isInviting }] =
		useInviteTenantUserMutation()
	const [updateTenantUser, { isLoading: isUpdating }] =
		useUpdateTenantUserMutation()
	const [deleteTenantUser, { isLoading: isDeleting }] =
		useDeleteTenantUserMutation()

	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [email, setEmail] = useState('')
	const [role, setRole] = useState<UserRole>(UserRole.EMPLOYEE)
	// const [isInternal, setIsInternal] = useState(false)
	const [feedback, setFeedback] = useState<string>('')
	const [tempPassword, setTempPassword] = useState<string>('')

	const isBusy =
		isLoading || isFetching || isInviting || isUpdating || isDeleting

	const sortedUsers = useMemo(() => {
		return [...users].sort((a, b) => a.email.localeCompare(b.email))
	}, [users])

	const resetForm = () => {
		setFirstName('')
		setLastName('')
		setEmail('')
		setRole(UserRole.EMPLOYEE)
		// setIsInternal(false)
	}

	const onInvite = async (event: React.FormEvent) => {
		event.preventDefault()
		setFeedback('')
		setTempPassword('')

		if (!firstName || !lastName || !email) {
			setFeedback('All invite fields are required.')
			return
		}

		try {
			const response = await inviteTenantUser({
				firstName,
				lastName,
				email,
				role,
				// isInternal,
			}).unwrap()

			setFeedback(`User invited: ${response.email}`)
			setTempPassword(response.temporaryPassword)
			resetForm()
		} catch (error: any) {
			setFeedback(error?.data?.message || 'Failed to invite user.')
		}
	}

	const onRoleChange = async (userId: string, nextRole: UserRole) => {
		setFeedback('')
		setTempPassword('')

		try {
			await updateTenantUser({
				userId,
				body: { role: nextRole },
			}).unwrap()
			setFeedback('User role updated successfully.')
		} catch (error: any) {
			setFeedback(error?.data?.message || 'Failed to update role.')
		}
	}

	const onDeleteUser = async (userId: string) => {
		setFeedback('')
		setTempPassword('')

		try {
			await deleteTenantUser(userId).unwrap()
			setFeedback('User deleted successfully.')
		} catch (error: any) {
			setFeedback(error?.data?.message || 'Failed to delete user.')
		}
	}

	return (
		<Container maxW="6xl" py={8}>
			<Stack gap={6}>
				<CustomBreadcrumb items={breadCrumbItems[BreadCrumbItem.USERS]} />
				<Flex justify="space-between" align="center">
					<Box>
						<Heading size="lg">Tenant Users</Heading>
						<Text color="gray.600">
							Invite and manage users within your tenant.
						</Text>
					</Box>
					{isBusy ? <Spinner size="sm" /> : null}
				</Flex>

				{feedback ? (
					<Alert status={tempPassword ? 'success' : 'info'} borderRadius="md">
						<AlertIcon />
						<Box>
							<AlertTitle>Update</AlertTitle>
							<AlertDescription>{feedback}</AlertDescription>
							{tempPassword ? (
								<AlertDescription mt={1}>
									Temporary password: <strong>{tempPassword}</strong>
								</AlertDescription>
							) : null}
						</Box>
					</Alert>
				) : null}

				<Box borderWidth="1px" borderRadius="xl" p={5}>
					<Heading size="md" mb={4}>
						Invite User
					</Heading>
					<form onSubmit={onInvite}>
						<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
							<FormControl isRequired>
								<FormLabel>First Name</FormLabel>
								<Input
									value={firstName}
									onChange={event => setFirstName(event.target.value)}
								/>
							</FormControl>

							<FormControl isRequired>
								<FormLabel>Last Name</FormLabel>
								<Input
									value={lastName}
									onChange={event => setLastName(event.target.value)}
								/>
							</FormControl>

							<FormControl isRequired>
								<FormLabel>Email</FormLabel>
								<Input
									type="email"
									value={email}
									onChange={event => setEmail(event.target.value)}
								/>
							</FormControl>

							<FormControl isRequired>
								<FormLabel>Role</FormLabel>
								<Select
									value={role}
									onChange={event => setRole(event.target.value as UserRole)}
								>
									{USER_ROLE_OPTIONS.map(roleValue => (
										<option key={roleValue} value={roleValue}>
											{roleValue}
										</option>
									))}
								</Select>
							</FormControl>
						</SimpleGrid>

						{/* <Checkbox
							mt={4}
							isChecked={isInternal}
							onChange={event => setIsInternal(event.target.checked)}
						>
							Internal User
						</Checkbox> */}

						<Button
							m={'2rem'}
							width={'100%'}
							type="submit"
							colorScheme="blue"
							isLoading={isInviting}
						>
							Invite User
						</Button>
					</form>
				</Box>

				<Box borderWidth="1px" borderRadius="xl" overflowX="auto">
					<Table>
						<Thead>
							<Tr>
								<Th>Name</Th>
								<Th>Email</Th>
								<Th>Role</Th>
								{/* <Th>Type</Th> */}
								<Th textAlign="right">Actions</Th>
							</Tr>
						</Thead>
						<Tbody>
							{sortedUsers.map(user => (
								<Tr key={user._id}>
									<Td>
										{user.firstName} {user.lastName}
									</Td>
									<Td>{user.email}</Td>
									<Td>
										<Select
											size="sm"
											value={user.role}
											onChange={event =>
												onRoleChange(
													user.userId,
													event.target.value as UserRole,
												)
											}
										>
											{USER_ROLE_OPTIONS.map(roleValue => (
												<option
													key={`${user._id}-${roleValue}`}
													value={roleValue}
												>
													{roleValue}
												</option>
											))}
										</Select>
									</Td>
									{/* <Td>
										<Badge colorScheme={user.isInternal ? 'purple' : 'green'}>
											{user.isInternal ? 'Internal' : 'External'}
										</Badge>
									</Td> */}
									<Td textAlign="right">
										<Button
											size="sm"
											colorScheme="red"
											variant="outline"
											onClick={() => onDeleteUser(user.userId)}
										>
											Delete
										</Button>
									</Td>
								</Tr>
							))}
						</Tbody>
					</Table>
				</Box>
			</Stack>
		</Container>
	)
}

export default UsersLogIn
