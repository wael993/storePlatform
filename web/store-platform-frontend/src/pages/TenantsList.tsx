import { useMemo, useState } from 'react'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Badge,
	Box,
	Button,
	ButtonGroup,
	Checkbox,
	Container,
	Divider,
	Flex,
	FormControl,
	FormLabel,
	Grid,
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
	Switch,
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
import {
	TENANT_PAGE_DESCRIPTION_KEYS,
	TENANT_PAGE_LABEL_KEYS,
	TenantAccessiblePage,
} from '../shared/tenantAccessiblePages'
import {
	getEnabledActions,
	getGloballyEnabledTenantPages,
} from '../shared/utils'

import { ChangeIcon } from '../icons/Change'

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
	const [accessibleTenant, setAccessibleTenant] =
		useState<TenantSummary | null>(null)
	const [selectedPages, setSelectedPages] = useState<TenantAccessiblePage[]>([])
	const [tenantName, setTenantName] = useState('')
	const { isOpen, onOpen, onClose } = useDisclosure()
	const {
		isOpen: isOpenEditAccessibleModal,
		onOpen: onOpenEditAccessibleModal,
		onClose: onCloseEditAccessibleModal,
	} = useDisclosure()

	const configurablePages = useMemo(
		() => getGloballyEnabledTenantPages(getEnabledActions()),
		[],
	)

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

	const openAccessibleModal = (tenant: TenantSummary) => {
		if (!tenant.permissions.canChangeTenantSettings) {
			setFeedback(tenant.permissions.reason || t('tenants.cannotUpdate'))
			return
		}

		setAccessibleTenant(tenant)
		setSelectedPages(
			tenant.accessiblePages.filter((page): page is TenantAccessiblePage =>
				configurablePages.includes(page as TenantAccessiblePage),
			),
		)
		setFeedback('')
		onOpenEditAccessibleModal()
	}

	const closeAccessibleModal = () => {
		setAccessibleTenant(null)
		setSelectedPages([])
		onCloseEditAccessibleModal()
	}

	const togglePage = (page: TenantAccessiblePage) => {
		setSelectedPages(current =>
			current.includes(page)
				? current.filter(item => item !== page)
				: [...current, page],
		)
	}

	const selectAllPages = () => {
		setSelectedPages([...configurablePages])
	}

	const clearAllPages = () => {
		setSelectedPages([])
	}

	const saveAccessiblePages = async () => {
		if (!accessibleTenant) {
			return
		}

		if (selectedPages.length === 0) {
			setFeedback(t('tenants.accessiblePagesNoneSelected'))
			return
		}

		try {
			await updateTenant({
				tenantId: accessibleTenant.tenantId,
				body: { accessiblePages: selectedPages },
			}).unwrap()
			setFeedback(t('tenants.accessiblePagesSaveSuccess'))
			closeAccessibleModal()
		} catch (error) {
			const err = error as { data?: { message?: string } }
			setFeedback(err?.data?.message || t('tenants.accessiblePagesSaveFailed'))
		}
	}

	const saveTenant = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!selectedTenant) {
			return
		}

		try {
			await updateTenant({
				tenantId: selectedTenant.tenantId,
				body: {
					tenantName,
					status: selectedTenant.status,
					...(selectedTenant.permissions.canChangeTenantSettings
						? { offlineEnabled: selectedTenant.offlineEnabled }
						: {}),
				},
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
								<Th>{t('tenants.offlineMode')}</Th>
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
										<Td>
											<Badge
												colorScheme={tenant.offlineEnabled ? 'blue' : 'gray'}
											>
												{tenant.offlineEnabled
													? t('tenants.offlineEnabled')
													: t('tenants.onlineOnly')}
											</Badge>
										</Td>
										<Td>{new Date(tenant.createdAt).toLocaleString()}</Td>
										<Td>
											{!permissions.canUpdate &&
											!permissions.canToggleStatus &&
											!permissions.canDelete &&
											!permissions.canChangeTenantSettings ? (
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
													{permissions.canChangeTenantSettings ? (
														<Tooltip
															label={t('tenants.AccessibleTenantPages')}
															hasArrow
														>
															<IconButton
																aria-label={t('tenants.AccessibleTenantPages')}
																onClick={() => openAccessibleModal(tenant)}
																icon={<ChangeIcon />}
															/>
														</Tooltip>
													) : null}

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
								{selectedTenant?.permissions.canChangeTenantSettings ? (
									<FormControl
										display="flex"
										alignItems="center"
										justifyContent="space-between"
									>
										<Box>
											<FormLabel mb={0}>{t('tenants.offlineMode')}</FormLabel>
											<Text fontSize="sm" color="gray.500">
												{t('tenants.offlineModeDescription')}
											</Text>
										</Box>
										<Switch
											isChecked={selectedTenant.offlineEnabled}
											onChange={event =>
												setSelectedTenant(prev =>
													prev
														? {
																...prev,
																offlineEnabled: event.target.checked,
															}
														: prev,
												)
											}
										/>
									</FormControl>
								) : null}
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

			<Modal
				isOpen={isOpenEditAccessibleModal}
				onClose={closeAccessibleModal}
				size="5xl"
				isCentered
				scrollBehavior="inside"
			>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>
						<Stack gap={1}>
							<Text>{t('tenants.accessiblePagesTitle')}</Text>
							<Text fontSize="sm" fontWeight="normal" color="gray.600">
								{t('tenants.accessiblePagesDescription')}
							</Text>
						</Stack>
					</ModalHeader>
					<ModalCloseButton />
					<Divider />
					<ModalBody py={6}>
						<Grid templateColumns={{ base: '1fr', lg: '1.4fr 1fr' }} gap={8}>
							<Box>
								<Flex
									justify="space-between"
									align={{ base: 'stretch', sm: 'center' }}
									direction={{ base: 'column', sm: 'row' }}
									gap={3}
									mb={4}
								>
									<Text fontWeight="semibold">
										{t('tenants.accessiblePagesSelected', {
											count: selectedPages.length,
											total: configurablePages.length,
										})}
									</Text>
									<ButtonGroup size="sm">
										<Button variant="outline" onClick={selectAllPages}>
											{t('tenants.accessiblePagesSelectAll')}
										</Button>
										<Button variant="ghost" onClick={clearAllPages}>
											{t('tenants.accessiblePagesClearAll')}
										</Button>
									</ButtonGroup>
								</Flex>

								<Stack
									gap={2}
									maxH="420px"
									overflowY="auto"
									pr={2}
									sx={{
										'&::-webkit-scrollbar': { width: '6px' },
										'&::-webkit-scrollbar-thumb': {
											background: '#CBD5E0',
											borderRadius: '999px',
										},
									}}
								>
									{configurablePages.map(page => {
										const isChecked = selectedPages.includes(page)

										return (
											<Box
												key={page}
												borderWidth="1px"
												borderRadius="lg"
												p={3}
												bg={isChecked ? 'blue.50' : 'white'}
												borderColor={isChecked ? 'blue.200' : 'gray.200'}
												_hover={{ borderColor: 'blue.300' }}
												cursor="pointer"
												onClick={() => togglePage(page)}
											>
												<Checkbox
													isChecked={isChecked}
													onChange={() => togglePage(page)}
													pointerEvents="none"
												>
													<Stack gap={0.5}>
														<Text fontWeight="medium">
															{t(TENANT_PAGE_LABEL_KEYS[page])}
														</Text>
														<Text fontSize="sm" color="gray.600">
															{t(TENANT_PAGE_DESCRIPTION_KEYS[page])}
														</Text>
													</Stack>
												</Checkbox>
											</Box>
										)
									})}
								</Stack>
							</Box>

							<Box
								bg="gray.50"
								borderRadius="xl"
								p={5}
								borderWidth="1px"
								borderColor="gray.200"
								alignSelf="start"
							>
								<Stack gap={4}>
									<Box>
										<Text
											fontSize="xs"
											textTransform="uppercase"
											color="gray.500"
											mb={1}
										>
											{t('tenants.accessiblePagesSummary')}
										</Text>
										<Heading size="md">{accessibleTenant?.name}</Heading>
										<Text color="gray.600" fontSize="sm" mt={1}>
											{accessibleTenant?.domain}
										</Text>
									</Box>

									<Divider />

									<Stack gap={2} fontSize="sm">
										<Flex justify="space-between" gap={4}>
											<Text color="gray.600">{t('common.status')}</Text>
											<Badge
												colorScheme={
													accessibleTenant?.status === 'active'
														? 'green'
														: 'orange'
												}
											>
												{accessibleTenant?.status === 'active'
													? t('common.active')
													: t('common.inactive')}
											</Badge>
										</Flex>
										<Flex justify="space-between" gap={4}>
											<Text color="gray.600">{t('tenants.created')}</Text>
											<Text>
												{accessibleTenant
													? new Date(
															accessibleTenant.createdAt,
														).toLocaleDateString()
													: '-'}
											</Text>
										</Flex>
									</Stack>

									<Divider />

									<Box>
										<Text fontSize="sm" color="gray.600" mb={2}>
											{t('tenants.AccessibleTenantPages')}
										</Text>
										<Flex gap={2} flexWrap="wrap">
											{selectedPages.length ? (
												selectedPages.map(page => (
													<Badge key={page} colorScheme="blue" variant="subtle">
														{t(TENANT_PAGE_LABEL_KEYS[page])}
													</Badge>
												))
											) : (
												<Text fontSize="sm" color="gray.500">
													{t('tenants.accessiblePagesNoneSelected')}
												</Text>
											)}
										</Flex>
									</Box>
								</Stack>
							</Box>
						</Grid>
					</ModalBody>
					<ModalFooter>
						<Button variant="ghost" mr={3} onClick={closeAccessibleModal}>
							{t('common.cancel')}
						</Button>
						<Button
							colorScheme="blue"
							onClick={saveAccessiblePages}
							isLoading={isUpdating}
							isDisabled={selectedPages.length === 0}
						>
							{t('common.save')}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Container>
	)
}

export default TenantsList
