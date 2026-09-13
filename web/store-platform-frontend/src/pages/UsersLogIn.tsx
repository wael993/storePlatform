import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	AlertTitle,
	Box,
	Button,
	Container,
	Flex,
	FormControl,
	FormErrorMessage,
	FormLabel,
	Heading,
	Input,
	SimpleGrid,
	Spinner,
	Stack,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
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
	useGetWarehousesQuery,
	useInviteTenantUserMutation,
	useUpdateTenantUserMutation,
} from '../api/apiStore'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { Dropdown } from '../components/dropdown/Dropdown'
import RoleAccessPanel from '../components/users/RoleAccessPanel'
import { generateBreadcrumbs } from '../shared/routes'
import { useTranslation } from 'react-i18next'
import { useSee } from '../shared/hooks/useSee'
import { useUser } from '../shared/hooks/useUser'
import { SEE } from '../shared/seeFlags'

const TENANT_USER_ROLES = [
	UserRole.OWNER,
	UserRole.ADMIN,
	UserRole.CASHIER,
	UserRole.EMPLOYEE,
] as const

const createInviteUserSchema = (t: (key: string) => string) =>
	z.object({
		firstName: z.string().min(1, t('addTenant.validation.firstNameRequired')),
		lastName: z.string().min(1, t('addTenant.validation.lastNameRequired')),
		email: z.email(t('addTenant.validation.emailInvalid')),
		role: z.union([
			z.literal('owner'),
			z.literal('admin'),
			z.literal('cashier'),
			z.literal('employee'),
		]),
	})

type InviteUserFormData = z.infer<ReturnType<typeof createInviteUserSchema>>

const UsersLogIn = () => {
	const { t } = useTranslation()
	const { isOwner, userId: currentUserId } = useUser()
	const { canSee } = useSee()
	const breadCrumbItems = generateBreadcrumbs()
	const inviteUserSchema = useMemo(() => createInviteUserSchema(t), [t])
	const {
		data: users = [],
		isLoading,
		isFetching,
	} = useGetTenantUsersQuery(undefined, {
		skip: !canSee(SEE.usersList) || !isOwner,
	})
	const { data: warehouses = [] } = useGetWarehousesQuery(undefined, {
		skip: !canSee(SEE.usersList) || !isOwner,
	})
	const [inviteTenantUser, { isLoading: isInviting }] =
		useInviteTenantUserMutation()
	const [updateTenantUser, { isLoading: isUpdating }] =
		useUpdateTenantUserMutation()
	const [deleteTenantUser, { isLoading: isDeleting }] =
		useDeleteTenantUserMutation()

	const [feedback, setFeedback] = useState<string>('')
	const [tempPassword, setTempPassword] = useState<string>('')
	const warehousePatchChain = useRef(Promise.resolve())

	const warehouseOptions = useMemo(
		() =>
			warehouses.map(warehouse => ({
				value: warehouse.warehouseId,
				label: warehouse.name,
			})),
		[warehouses],
	)

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors, isValid },
	} = useForm<InviteUserFormData>({
		resolver: zodResolver(inviteUserSchema),
		mode: 'onChange',
		defaultValues: { role: UserRole.EMPLOYEE },
	})

	const inviteRole = watch('role')

	const isBusy =
		isLoading || isFetching || isInviting || isUpdating || isDeleting

	const sortedUsers = useMemo(() => {
		return [...users].sort((a, b) => a.email.localeCompare(b.email))
	}, [users])

	const roleOptions: TenantUserRole[] = isOwner
		? [...TENANT_USER_ROLES]
		: TENANT_USER_ROLES.filter(role => role !== UserRole.OWNER)

	const roleDropdownOptions = useMemo(
		() =>
			roleOptions.map(roleValue => ({
				value: roleValue,
				label: t(`users.roles.${roleValue}`),
			})),
		[roleOptions, t],
	)

	const showInvite = canSee(SEE.usersInvite)
	const showUsers = canSee(SEE.usersList)

	const onInvite = async (formData: InviteUserFormData) => {
		setFeedback('')
		setTempPassword('')

		try {
			const response = await inviteTenantUser(formData).unwrap()

			setFeedback(t('users.invited', { email: response.email }))
			setTempPassword(response.temporaryPassword)
			reset()
		} catch (error: unknown) {
			const err = error as { data?: { message?: string } }
			setFeedback(err?.data?.message || t('users.inviteFailed'))
		}
	}

	const onRoleChange = async (userId: string, nextRole: TenantUserRole) => {
		setFeedback('')
		setTempPassword('')

		try {
			await updateTenantUser({
				userId,
				body: { role: nextRole },
			}).unwrap()
			setFeedback(t('users.roleUpdateSuccess'))
		} catch (error: unknown) {
			const err = error as { data?: { message?: string } }
			setFeedback(err?.data?.message || t('users.roleUpdateFailed'))
		}
	}

	const onWarehouseAccessChange = (userId: string, warehouseIds: string[]) => {
		warehousePatchChain.current = warehousePatchChain.current
			.catch(() => undefined)
			.then(async () => {
				setFeedback('')
				setTempPassword('')

				try {
					await updateTenantUser({
						userId,
						body: { warehouseIds },
					}).unwrap()
					setFeedback(t('users.warehouseAccessUpdateSuccess'))
				} catch (error: unknown) {
					const err = error as { data?: { message?: string } }
					setFeedback(
						err?.data?.message || t('users.warehouseAccessUpdateFailed'),
					)
				}
			})
	}

	const onDeleteUser = async (userId: string) => {
		setFeedback('')
		setTempPassword('')

		try {
			await deleteTenantUser(userId).unwrap()
			setFeedback(t('users.deleteSuccess'))
		} catch (error: unknown) {
			const err = error as { data?: { message?: string } }
			setFeedback(err?.data?.message || t('users.deleteFailed'))
		}
	}

	return (
		<Container maxW="6xl" py={8}>
			<Stack gap={6}>
				<CustomBreadcrumb items={breadCrumbItems[BreadCrumbItem.USERS]} />
				<Flex justify="space-between" align="center">
					<Box>
						<Heading size="lg">{t('users.title')}</Heading>
						<Text color="gray.600">{t('users.description')}</Text>
					</Box>
					{isBusy ? <Spinner size="sm" /> : null}
				</Flex>

				{feedback ? (
					<Alert status={tempPassword ? 'success' : 'info'} borderRadius="md">
						<AlertIcon />
						<Box>
							<AlertTitle>{t('users.update')}</AlertTitle>
							<AlertDescription>{feedback}</AlertDescription>
							{tempPassword ? (
								<AlertDescription mt={1}>
									{t('users.temporaryPassword')}:{' '}
									<strong>{tempPassword}</strong>
								</AlertDescription>
							) : null}
						</Box>
					</Alert>
				) : null}

				<Tabs variant="enclosed">
					<TabList>
						{showInvite ? <Tab>{t('users.inviteUser')}</Tab> : null}
						{showUsers ? <Tab>{t('users.usersTab')}</Tab> : null}
						{isOwner ? <Tab>{t('users.roleAccess.tab')}</Tab> : null}
					</TabList>
					<TabPanels>
						{showInvite ? (
							<TabPanel px={0}>
								<Box borderWidth="1px" borderRadius="xl" p={5}>
									<form onSubmit={handleSubmit(onInvite)}>
										<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
											<FormControl
												isRequired
												isInvalid={Boolean(errors.firstName)}
											>
												<FormLabel>{t('addTenant.firstName')}</FormLabel>
												<Input {...register('firstName')} />
												<FormErrorMessage>
													{errors.firstName?.message}
												</FormErrorMessage>
											</FormControl>

											<FormControl
												isRequired
												isInvalid={Boolean(errors.lastName)}
											>
												<FormLabel>{t('addTenant.lastName')}</FormLabel>
												<Input {...register('lastName')} />
												<FormErrorMessage>
													{errors.lastName?.message}
												</FormErrorMessage>
											</FormControl>

											<FormControl isRequired isInvalid={Boolean(errors.email)}>
												<FormLabel>{t('login.email')}</FormLabel>
												<Input type="email" {...register('email')} />
												<FormErrorMessage>
													{errors.email?.message}
												</FormErrorMessage>
											</FormControl>

											<FormControl isRequired>
												<FormLabel>{t('users.role')}</FormLabel>
												<Dropdown
													placeholder={t('users.role')}
													dropDownOptions={roleDropdownOptions}
													selectedValues={[inviteRole]}
													onSelect={(values: string[]) => {
														const nextRole = values[0] as TenantUserRole
														if (!nextRole) return
														setValue('role', nextRole, {
															shouldValidate: true,
															shouldDirty: true,
														})
													}}
													isSingle
													isSearchable={false}
													showClearOptions={false}
													usePortal
												/>
											</FormControl>
										</SimpleGrid>

										<Button
											m={'2rem'}
											width={'100%'}
											type="submit"
											colorScheme="blue"
											isLoading={isInviting}
											isDisabled={!isValid}
										>
											{t('users.inviteUser')}
										</Button>
									</form>
								</Box>
							</TabPanel>
						) : null}

						{showUsers ? (
							<TabPanel px={0}>
								<Box borderWidth="1px" borderRadius="xl" overflowX="auto">
									<Table>
										<Thead>
											<Tr>
												<Th>{t('users.name')}</Th>
												<Th>{t('login.email')}</Th>
												<Th>{t('users.role')}</Th>
												<Th minW="220px">{t('users.warehouseAccess')}</Th>
												<Th textAlign="right">{t('tenants.actions')}</Th>
											</Tr>
										</Thead>
										<Tbody>
											{sortedUsers.map(user => (
												<Tr key={user._id}>
													<Td>
														{user.firstName} {user.lastName}
													</Td>
													<Td>{user.email}</Td>
													<Td minW="160px">
														<Dropdown
															placeholder={t('users.role')}
															dropDownOptions={roleDropdownOptions}
															selectedValues={[user.role]}
															onSelect={(values: string[]) => {
																const nextRole = values[0] as TenantUserRole
																if (!nextRole || nextRole === user.role) return
																onRoleChange(user.userId, nextRole)
															}}
															isSingle
															isSearchable={false}
															showClearOptions={false}
															usePortal
															disabled={
																user.role === UserRole.OWNER &&
																user.userId === currentUserId
															}
														/>
													</Td>
													<Td>
														<Dropdown
															placeholder={t(
																'users.warehouseAccessPlaceholder',
															)}
															dropDownOptions={warehouseOptions}
															selectedValues={user.warehouseIds ?? []}
															onSelect={(values: string[]) =>
																onWarehouseAccessChange(user.userId, values)
															}
															disabled={user.role === UserRole.OWNER}
															showClearOptions
															usePortal
														/>
													</Td>
													<Td textAlign="right">
														<Button
															size="sm"
															colorScheme="red"
															variant="outline"
															isDisabled={
																user.role === UserRole.OWNER ||
																user.userId === currentUserId
															}
															onClick={() => onDeleteUser(user.userId)}
														>
															{t('common.delete')}
														</Button>
													</Td>
												</Tr>
											))}
										</Tbody>
									</Table>
								</Box>
							</TabPanel>
						) : null}

						{isOwner ? (
							<TabPanel px={0}>
								<RoleAccessPanel />
							</TabPanel>
						) : null}
					</TabPanels>
				</Tabs>
			</Stack>
		</Container>
	)
}

export default UsersLogIn
