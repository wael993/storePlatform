import { useMemo, useState } from 'react'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Badge,
	Box,
	Button,
	ButtonGroup,
	Container,
	FormControl,
	FormLabel,
	Heading,
	IconButton,
	Input,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Select,
	Spinner,
	Stack,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tooltip,
	Tr,
	useDisclosure,
} from '@chakra-ui/react'
import { DeleteIcon, EditIcon, LockIcon, UnlockIcon } from '@chakra-ui/icons'
import {
	useDeleteTenantMutation,
	useGetTenantsQuery,
	useUpdateTenantMutation,
} from '../api/apiStore'
import { useTranslation } from 'react-i18next'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { BreadCrumbItem } from '../shared/globalEnums'
import { generateBreadcrumbs } from '../shared/routes'

const TenantsList = () => {
	const { t } = useTranslation()
	const breadCrumbItems = generateBreadcrumbs()
	const { data: tenants = [], isLoading, isFetching } = useGetTenantsQuery()
	const [updateTenant, { isLoading: isUpdating }] = useUpdateTenantMutation()
	const [deleteTenant, { isLoading: isDeleting }] = useDeleteTenantMutation()
	const [feedback, setFeedback] = useState('')
	const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(
		null,
	)
	const [tenantName, setTenantName] = useState('')
	const { isOpen, onOpen, onClose } = useDisclosure()

	const sortedTenants = useMemo(() => {
		return [...tenants].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
	}, [tenants])

	const isBusy = isLoading || isFetching || isUpdating || isDeleting

	const openEditModal = (tenant: TenantSummary) => {
		if (!tenant.permissions.canUpdate) {
			setFeedback(tenant.permissions.reason || t('tenants.cannotUpdate'))
			return
		}

		setSelectedTenant(tenant)
		setTenantName(tenant.name)
		setFeedback('')
		onOpen()
	}

	const closeEditModal = () => {
		setSelectedTenant(null)
		setTenantName('')
		onClose()
	}

	const saveTenant = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!selectedTenant) {
			return
		}

		try {
			await updateTenant({
				tenantId: selectedTenant.tenantId,
				body: { tenantName, status: selectedTenant.status },
			}).unwrap()
			setFeedback(t('tenants.updateSuccess'))
			closeEditModal()
		} catch (error) {
			const err = error as { data?: { message?: string } }
			setFeedback(err?.data?.message || t('tenants.updateFailed'))
		}
	}

	const toggleTenantStatus = async (tenant: TenantSummary) => {
		if (!tenant.permissions.canToggleStatus) {
			setFeedback(tenant.permissions.reason || t('tenants.statusCannotChange'))
			return
		}

		try {
			await updateTenant({
				tenantId: tenant.tenantId,
				body: { status: tenant.status === 'active' ? 'inactive' : 'active' },
			}).unwrap()
			setFeedback(
				tenant.status === 'active'
					? t('tenants.deactivated')
					: t('tenants.activated'),
			)
		} catch (error) {
			const err = error as { data?: { message?: string } }
			setFeedback(err?.data?.message || t('tenants.statusChangeFailed'))
		}
	}

	const removeTenant = async (tenant: TenantSummary) => {
		if (!tenant.permissions.canDelete) {
			setFeedback(tenant.permissions.reason || t('tenants.cannotDelete'))
			return
		}

		const confirmed = window.confirm(
			t('tenants.deleteConfirmation', { tenantName: tenant.name }),
		)
		if (!confirmed) {
			return
		}

		try {
			await deleteTenant(tenant.tenantId).unwrap()
			setFeedback(t('tenants.deleteSuccess'))
		} catch (error) {
			const err = error as { data?: { message?: string } }
			setFeedback(err?.data?.message || t('tenants.deleteFailed'))
		}
	}

	return (
		<Container maxW="7xl" px={0}>
			<Stack gap={6}>
				<CustomBreadcrumb
					items={breadCrumbItems[BreadCrumbItem.TENANTS_LIST]}
				/>
				<Box>
					<Heading size="lg">{t('tenants.title')}</Heading>
					<Text color="gray.600">{t('tenants.description')}</Text>
				</Box>

				{feedback ? (
					<Alert status="info" borderRadius="md">
						<AlertIcon />
						<AlertDescription>{feedback}</AlertDescription>
					</Alert>
				) : null}

				<Box borderWidth="1px" borderRadius="xl" overflowX="auto" bg="white">
					<Table>
						<Thead>
							<Tr>
								<Th>{t('tenants.tenant')}</Th>
								<Th>{t('tenants.domain')}</Th>
								<Th>{t('common.status')}</Th>
								<Th>{t('tenants.created')}</Th>
								<Th textAlign="right">{t('tenants.actions')}</Th>
							</Tr>
						</Thead>
						<Tbody>
							{sortedTenants.map(tenant => {
								const { permissions } = tenant
								return (
									<Tr key={tenant.tenantId}>
										<Td>
											<Stack gap={1}>
												<Text fontWeight="semibold">{tenant.name}</Text>
												<Text fontSize="sm" color="gray.500">
													{tenant.tenantId}
												</Text>
											</Stack>
										</Td>
										<Td>{tenant.domain}</Td>
										<Td>
											<Badge
												colorScheme={
													tenant.status === 'active' ? 'green' : 'orange'
												}
											>
												{tenant.status === 'active'
													? t('common.active')
													: t('common.inactive')}
											</Badge>
										</Td>
										<Td>{new Date(tenant.createdAt).toLocaleString()}</Td>
										<Td>
											{!permissions.canUpdate &&
											!permissions.canToggleStatus &&
											!permissions.canDelete ? (
												<Text fontSize="sm" color="gray.500" textAlign="right">
													{permissions.reason ||
														t('tenants.noActionsAvailable')}
												</Text>
											) : (
												<ButtonGroup
													size="sm"
													justifyContent="flex-end"
													display="flex"
												>
													{permissions.canUpdate ? (
														<Tooltip label={t('tenants.updateTenant')} hasArrow>
															<IconButton
																aria-label={t('tenants.updateTenant')}
																onClick={() => openEditModal(tenant)}
																icon={<EditIcon />}
															/>
														</Tooltip>
													) : null}
													{permissions.canToggleStatus ? (
														<Tooltip
															label={
																tenant.status === 'active'
																	? t('tenants.deactivateTenant')
																	: t('tenants.activateTenant')
															}
															hasArrow
														>
															<IconButton
																aria-label={
																	tenant.status === 'active'
																		? t('tenants.deactivateTenant')
																		: t('tenants.activateTenant')
																}
																colorScheme={
																	tenant.status === 'active'
																		? 'orange'
																		: 'green'
																}
																onClick={() => toggleTenantStatus(tenant)}
																icon={
																	tenant.status === 'active' ? (
																		<LockIcon />
																	) : (
																		<UnlockIcon />
																	)
																}
															/>
														</Tooltip>
													) : null}
													{permissions.canDelete ? (
														<Tooltip label={t('tenants.deleteTenant')} hasArrow>
															<IconButton
																aria-label={t('tenants.deleteTenant')}
																colorScheme="red"
																onClick={() => removeTenant(tenant)}
																icon={<DeleteIcon />}
															/>
														</Tooltip>
													) : null}
												</ButtonGroup>
											)}
										</Td>
									</Tr>
								)
							})}
						</Tbody>
					</Table>
					{!sortedTenants.length && !isBusy ? (
						<Box p={6} textAlign="center">
							<Text color="gray.500">{t('tenants.empty')}</Text>
						</Box>
					) : null}
					{isBusy ? (
						<Box p={6} textAlign="center">
							<Spinner />
						</Box>
					) : null}
				</Box>
			</Stack>

			<Modal isOpen={isOpen} onClose={closeEditModal}>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>{t('tenants.updateTenant')}</ModalHeader>
					<ModalCloseButton />
					<form onSubmit={saveTenant}>
						<ModalBody>
							<Stack gap={4}>
								<FormControl isRequired>
									<FormLabel>{t('tenants.tenantName')}</FormLabel>
									<Input
										value={tenantName}
										onChange={event => setTenantName(event.target.value)}
									/>
								</FormControl>
								<FormControl>
									<FormLabel>{t('common.status')}</FormLabel>
									<Select
										value={selectedTenant?.status ?? 'active'}
										onChange={event =>
											setSelectedTenant(prev =>
												prev
													? {
															...prev,
															status: event.target.value as
																| 'active'
																| 'inactive',
														}
													: prev,
											)
										}
									>
										<option value="active">{t('common.active')}</option>
										<option value="inactive">{t('common.inactive')}</option>
									</Select>
								</FormControl>
							</Stack>
						</ModalBody>
						<ModalFooter>
							<Button variant="ghost" mr={3} onClick={closeEditModal}>
								{t('common.cancel')}
							</Button>
							<Button colorScheme="blue" type="submit" isLoading={isUpdating}>
								{t('common.save')}
							</Button>
						</ModalFooter>
					</form>
				</ModalContent>
			</Modal>
		</Container>
	)
}

export default TenantsList
