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
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { BreadCrumbItem } from '../shared/globalEnums'
import { generateBreadcrumbs } from '../shared/routes'

const TenantsList = () => {
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
			setFeedback(tenant.permissions.reason || 'Tenant cannot be updated.')
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
			setFeedback('Tenant updated successfully.')
			closeEditModal()
		} catch (error: any) {
			setFeedback(error?.data?.message || 'Failed to update tenant.')
		}
	}

	const toggleTenantStatus = async (tenant: TenantSummary) => {
		if (!tenant.permissions.canToggleStatus) {
			setFeedback(
				tenant.permissions.reason || 'Tenant status cannot be changed.',
			)
			return
		}

		try {
			await updateTenant({
				tenantId: tenant.tenantId,
				body: { status: tenant.status === 'active' ? 'inactive' : 'active' },
			}).unwrap()
			setFeedback(
				`Tenant ${tenant.status === 'active' ? 'deactivated' : 'activated'}.`,
			)
		} catch (error: any) {
			setFeedback(error?.data?.message || 'Failed to change tenant status.')
		}
	}

	const removeTenant = async (tenant: TenantSummary) => {
		if (!tenant.permissions.canDelete) {
			setFeedback(tenant.permissions.reason || 'Tenant cannot be deleted.')
			return
		}

		const confirmed = window.confirm(
			`Delete tenant ${tenant.name}? This will remove all tenant data.`,
		)
		if (!confirmed) {
			return
		}

		try {
			await deleteTenant(tenant.tenantId).unwrap()
			setFeedback('Tenant deleted successfully.')
		} catch (error: any) {
			setFeedback(error?.data?.message || 'Failed to delete tenant.')
		}
	}

	return (
		<Container maxW="7xl" px={0}>
			<Stack gap={6}>
				<CustomBreadcrumb
					items={breadCrumbItems[BreadCrumbItem.TENANTS_LIST]}
				/>
				<Box>
					<Heading size="lg">Tenants List</Heading>
					<Text color="gray.600">
						Review tenants, switch their status, edit names, or delete them.
					</Text>
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
								<Th>Tenant</Th>
								<Th>Domain</Th>
								<Th>Status</Th>
								<Th>Created</Th>
								<Th textAlign="right">Actions</Th>
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
												{tenant.status}
											</Badge>
										</Td>
										<Td>{new Date(tenant.createdAt).toLocaleString()}</Td>
										<Td>
											{!permissions.canUpdate &&
											!permissions.canToggleStatus &&
											!permissions.canDelete ? (
												<Text fontSize="sm" color="gray.500" textAlign="right">
													{permissions.reason || 'No actions available'}
												</Text>
											) : (
												<ButtonGroup
													size="sm"
													justifyContent="flex-end"
													display="flex"
												>
													{permissions.canUpdate ? (
														<Tooltip label="Update tenant" hasArrow>
															<IconButton
																aria-label="Update tenant"
																onClick={() => openEditModal(tenant)}
																icon={<EditIcon />}
															/>
														</Tooltip>
													) : null}
													{permissions.canToggleStatus ? (
														<Tooltip
															label={
																tenant.status === 'active'
																	? 'Deactivate tenant'
																	: 'Activate tenant'
															}
															hasArrow
														>
															<IconButton
																aria-label={
																	tenant.status === 'active'
																		? 'Deactivate tenant'
																		: 'Activate tenant'
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
														<Tooltip label="Delete tenant" hasArrow>
															<IconButton
																aria-label="Delete tenant"
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
							<Text color="gray.500">No tenants found.</Text>
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
					<ModalHeader>Update Tenant</ModalHeader>
					<ModalCloseButton />
					<form onSubmit={saveTenant}>
						<ModalBody>
							<Stack gap={4}>
								<FormControl isRequired>
									<FormLabel>Tenant Name</FormLabel>
									<Input
										value={tenantName}
										onChange={event => setTenantName(event.target.value)}
									/>
								</FormControl>
								<FormControl>
									<FormLabel>Status</FormLabel>
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
										<option value="active">active</option>
										<option value="inactive">inactive</option>
									</Select>
								</FormControl>
							</Stack>
						</ModalBody>
						<ModalFooter>
							<Button variant="ghost" mr={3} onClick={closeEditModal}>
								Cancel
							</Button>
							<Button colorScheme="blue" type="submit" isLoading={isUpdating}>
								Save
							</Button>
						</ModalFooter>
					</form>
				</ModalContent>
			</Modal>
		</Container>
	)
}

export default TenantsList
