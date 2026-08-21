import { useEffect, useRef, useState } from 'react'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Badge,
	Box,
	Button,
	Container,
	Divider,
	Flex,
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
	Stack,
	Table,
	Tbody,
	Td,
	Text,
	Textarea,
	Th,
	Thead,
	Tr,
	useDisclosure,
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon } from '@chakra-ui/icons'
import { useTranslation } from 'react-i18next'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { formatRenewalDate } from '../components/SubscriptionRenewalBanner'
import { BreadCrumbItem } from '../shared/globalEnums'
import { generateBreadcrumbs } from '../shared/routes'
import {
	useApproveRenewalRequestMutation,
	useGetRenewalRequestsQuery,
	useGetSubscriptionPaymentSettingsQuery,
	useRejectRenewalRequestMutation,
	useUpdateSubscriptionPaymentSettingsMutation,
} from '../api/apiStore'

const emptySettings = (): SubscriptionPaymentSettings => ({
	contactName: '',
	contactEmail: '',
	contactPhone: '',
	methods: [],
})

const statusColor = (status: RenewalRequestView['status']) => {
	if (status === 'approved') {
		return 'green'
	}

	if (status === 'rejected' || status === 'cancelled') {
		return 'red'
	}

	return 'orange'
}

const RenewalRequestsPage = () => {
	const { t, i18n } = useTranslation()
	const breadCrumbItems = generateBreadcrumbs()
	const { data, isLoading } = useGetRenewalRequestsQuery()
	const { data: paymentSettings } = useGetSubscriptionPaymentSettingsQuery()
	const [savePaymentSettings, { isLoading: isSavingPayment }] =
		useUpdateSubscriptionPaymentSettingsMutation()
	const [approveRequest, { isLoading: isApproving }] =
		useApproveRenewalRequestMutation()
	const [rejectRequest, { isLoading: isRejecting }] =
		useRejectRenewalRequestMutation()
	const [settings, setSettings] = useState(emptySettings)
	const paymentFormHydrated = useRef(false)
	const [feedback, setFeedback] = useState('')
	const [rejectionReason, setRejectionReason] = useState('')
	const [selected, setSelected] = useState<RenewalRequestView | null>(null)
	const reviewModal = useDisclosure()
	const isReviewing = isApproving || isRejecting
	const requests = data?.requests ?? []

	useEffect(() => {
		if (paymentSettings && !paymentFormHydrated.current) {
			setSettings(paymentSettings)
			paymentFormHydrated.current = true
		}
	}, [paymentSettings])

	const openReview = (request: RenewalRequestView) => {
		setSelected(request)
		setRejectionReason(request.rejectionReason ?? '')
		setFeedback('')
		reviewModal.onOpen()
	}

	const saveSettings = async () => {
		try {
			await savePaymentSettings(settings).unwrap()
			setFeedback(t('tenants.paymentSettingsSaved'))
		} catch {
			setFeedback(t('tenants.paymentSettingsSaveFailed'))
		}
	}

	const approve = async () => {
		if (!selected) {
			return
		}

		try {
			await approveRequest(selected.requestId).unwrap()
			reviewModal.onClose()
			setSelected(null)
			setFeedback(t('tenants.approveSuccess'))
		} catch {
			setFeedback(t('tenants.reviewFailed'))
		}
	}

	const reject = async () => {
		if (!selected) {
			return
		}

		try {
			await rejectRequest({
				requestId: selected.requestId,
				reason: rejectionReason,
			}).unwrap()
			reviewModal.onClose()
			setSelected(null)
			setFeedback(t('tenants.rejectSuccess'))
		} catch {
			setFeedback(t('tenants.reviewFailed'))
		}
	}

	return (
		<Container maxW="7xl" px={0}>
			<Stack gap={6}>
				<CustomBreadcrumb
					items={breadCrumbItems[BreadCrumbItem.RENEWAL_REQUESTS]}
				/>
				<Box>
					<Heading size="lg">{t('tenants.renewalRequests')}</Heading>
					<Text color="gray.600">{t('tenants.renewalRequestsDescription')}</Text>
				</Box>

				{feedback ? (
					<Alert status="info" borderRadius="md">
						<AlertIcon />
						<AlertDescription>{feedback}</AlertDescription>
					</Alert>
				) : null}

				<Box borderWidth="1px" borderRadius="xl" bg="white" p={5}>
					<Heading size="md">{t('tenants.paymentSettings')}</Heading>
					<Text color="gray.600" mb={4}>
						{t('tenants.paymentSettingsDescription')}
					</Text>
					<Stack gap={4}>
						<FormControl>
							<FormLabel>{t('tenants.contactName')}</FormLabel>
							<Input
								value={settings.contactName}
								onChange={event =>
									setSettings(current => ({
										...current,
										contactName: event.target.value,
									}))
								}
							/>
						</FormControl>
						<FormControl>
							<FormLabel>{t('tenants.contactEmail')}</FormLabel>
							<Input
								value={settings.contactEmail}
								onChange={event =>
									setSettings(current => ({
										...current,
										contactEmail: event.target.value,
									}))
								}
							/>
						</FormControl>
						<FormControl>
							<FormLabel>{t('tenants.contactPhone')}</FormLabel>
							<Input
								value={settings.contactPhone}
								onChange={event =>
									setSettings(current => ({
										...current,
										contactPhone: event.target.value,
									}))
								}
							/>
						</FormControl>
						<Divider />
						<Flex align="center" justify="space-between">
							<Text fontWeight="semibold">{t('subscription.paymentMethods')}</Text>
							<Button
								size="sm"
								leftIcon={<AddIcon />}
								onClick={() =>
									setSettings(current => ({
										...current,
										methods: [
											...current.methods,
											{
												id: crypto.randomUUID(),
												name: '',
												details: '',
												qrUrl: '',
											},
										],
									}))
								}
							>
								{t('tenants.addPaymentMethod')}
							</Button>
						</Flex>
						{settings.methods.map((method, index) => (
							<Box
								key={method.id}
								borderWidth="1px"
								borderRadius="md"
								p={4}
							>
								<Flex justify="space-between" mb={3}>
									<Text fontWeight="medium">
										{method.name || t('tenants.methodName')}
									</Text>
									<IconButton
										aria-label={t('tenants.removeMethod')}
										icon={<DeleteIcon />}
										size="sm"
										onClick={() =>
											setSettings(current => ({
												...current,
												methods: current.methods.filter(
													item => item.id !== method.id,
												),
											}))
										}
									/>
								</Flex>
								<Stack gap={3}>
									<FormControl>
										<FormLabel>{t('tenants.methodName')}</FormLabel>
										<Input
											value={method.name}
											onChange={event =>
												setSettings(current => ({
													...current,
													methods: current.methods.map((item, itemIndex) =>
														itemIndex === index
															? { ...item, name: event.target.value }
															: item,
													),
												}))
											}
										/>
									</FormControl>
									<FormControl>
										<FormLabel>{t('tenants.methodDetails')}</FormLabel>
										<Textarea
											value={method.details}
											onChange={event =>
												setSettings(current => ({
													...current,
													methods: current.methods.map((item, itemIndex) =>
														itemIndex === index
															? { ...item, details: event.target.value }
															: item,
													),
												}))
											}
										/>
									</FormControl>
									<FormControl>
										<FormLabel>{t('tenants.methodQrUrl')}</FormLabel>
										<Input
											value={method.qrUrl}
											placeholder="https://"
											onChange={event =>
												setSettings(current => ({
													...current,
													methods: current.methods.map((item, itemIndex) =>
														itemIndex === index
															? { ...item, qrUrl: event.target.value }
															: item,
													),
												}))
											}
										/>
										<Text fontSize="xs" color="gray.500" mt={1}>
											{t('tenants.methodQrUrlHint')}
										</Text>
									</FormControl>
								</Stack>
							</Box>
						))}
						<Button
							alignSelf="flex-start"
							colorScheme="blue"
							isLoading={isSavingPayment}
							onClick={() => void saveSettings()}
						>
							{t('common.save')}
						</Button>
					</Stack>
				</Box>

				<Box borderWidth="1px" borderRadius="xl" overflowX="auto" bg="white">
					<Table>
						<Thead>
							<Tr>
								<Th>{t('tenants.tenant')}</Th>
								<Th>{t('tenants.requestedAt')}</Th>
								<Th>{t('common.status')}</Th>
								<Th textAlign="right">{t('tenants.actions')}</Th>
							</Tr>
						</Thead>
						<Tbody>
							{requests.map(request => (
								<Tr key={request.requestId}>
									<Td>
										<Stack gap={1}>
											<Text fontWeight="semibold">{request.tenantName}</Text>
											<Text fontSize="sm" color="gray.500">
												{request.tenantId}
											</Text>
										</Stack>
									</Td>
									<Td>{new Date(request.requestedAt).toLocaleString()}</Td>
									<Td>
										<Badge colorScheme={statusColor(request.status)}>
											{t(`subscription.status${request.status[0].toUpperCase()}${request.status.slice(1)}`)}
										</Badge>
									</Td>
									<Td textAlign="right">
										<Button size="sm" onClick={() => openReview(request)}>
											{request.status === 'pending'
												? t('tenants.review')
												: t('tenants.view')}
										</Button>
									</Td>
								</Tr>
							))}
							{!isLoading && requests.length === 0 ? (
								<Tr>
									<Td colSpan={4}>
										<Text color="gray.500">{t('tenants.noRenewalRequests')}</Text>
									</Td>
								</Tr>
							) : null}
						</Tbody>
					</Table>
				</Box>
			</Stack>

			<Modal
				isOpen={reviewModal.isOpen}
				onClose={reviewModal.onClose}
				size="lg"
			>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>{t('tenants.renewalRequests')}</ModalHeader>
					<ModalCloseButton />
					<ModalBody>
						{selected ? (
							<Stack gap={3}>
								<Text>
									{t('tenants.tenant')}: {selected.tenantName}
								</Text>
								<Text>
									{t('tenants.requestedBy')}: {selected.requestedBy.displayName}
								</Text>
								<Text>
									{t('tenants.requestedAt')}:{' '}
									{new Date(selected.requestedAt).toLocaleString()}
								</Text>
								<Text>
									{t('tenants.currentExpiration')}:{' '}
									{formatRenewalDate(
										selected.currentExpirationDate,
										i18n.language,
									)}
								</Text>
								{selected.tenantStatus ? (
									<Text>
										{t('tenants.tenantStatus')}: {selected.tenantStatus}
									</Text>
								) : null}
								{selected.subscription ? (
									<Text>
										{t('tenants.renewalDate')}:{' '}
										{formatRenewalDate(
											selected.subscription.renewalDate,
											i18n.language,
										)}
									</Text>
								) : null}
								<Text>
									{t('subscription.status')}:{' '}
									{t(
										`subscription.status${selected.status[0].toUpperCase()}${selected.status.slice(1)}`,
									)}
								</Text>
								{selected.reviewedBy ? (
									<Text>
										{t('tenants.reviewedBy')}: {selected.reviewedBy.displayName}
									</Text>
								) : null}
								{selected.reviewedAt ? (
									<Text>
										{t('tenants.reviewedAt')}:{' '}
										{new Date(selected.reviewedAt).toLocaleString()}
									</Text>
								) : null}
								{selected.rejectionReason ? (
									<Text>
										{t('subscription.reason')}: {selected.rejectionReason}
									</Text>
								) : null}
								{selected.status === 'pending' ? (
									<FormControl>
										<FormLabel>{t('tenants.rejectionReason')}</FormLabel>
										<Textarea
											value={rejectionReason}
											placeholder={t('tenants.rejectionReasonPlaceholder')}
											onChange={event => setRejectionReason(event.target.value)}
										/>
									</FormControl>
								) : null}
							</Stack>
						) : null}
					</ModalBody>
					<ModalFooter>
						<Button me={3} onClick={reviewModal.onClose}>
							{t('common.cancel')}
						</Button>
						{selected?.status === 'pending' ? (
							<>
								<Button
									me={3}
									colorScheme="red"
									isLoading={isRejecting}
									isDisabled={isReviewing}
									onClick={() => void reject()}
								>
									{t('tenants.reject')}
								</Button>
								<Button
									colorScheme="green"
									isLoading={isApproving}
									isDisabled={isReviewing}
									onClick={() => void approve()}
								>
									{t('tenants.approve')}
								</Button>
							</>
						) : null}
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Container>
	)
}

export default RenewalRequestsPage
