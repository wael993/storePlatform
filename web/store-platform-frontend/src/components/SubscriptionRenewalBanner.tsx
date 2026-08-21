import { useState } from 'react'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	AlertTitle,
	Box,
	Button,
	CloseButton,
	Divider,
	Image,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Stack,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { UserRole } from '../shared/globalEnums'
import { useUser } from '../shared/hooks/useUser'
import {
	useCreateRenewalRequestMutation,
	useGetSubscriptionPaymentInfoQuery,
	useGetSubscriptionQuery,
} from '../api/apiStore'
import useCustomToast from './common/CustomToast'
import { layout } from '../theme/layout'

const ALLOWED_QR_URL = /^(https?:\/\/|data:image\/)/i

export const isAllowedPaymentQrUrl = (url: string) =>
	ALLOWED_QR_URL.test(url.trim())

const dismissKey = (tenantId: string, remainingDays: number) =>
	`subscription-banner:${tenantId}:${remainingDays}`

const formatRenewalDate = (ymd: string, locale: string) => {
	const [year, month, day] = ymd.split('-').map(Number)

	return new Date(year, month - 1, day).toLocaleDateString(locale, {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	})
}

export const subscriptionRemainingMessage = (
	t: (key: string, options?: Record<string, unknown>) => string,
	remainingDays: number,
	date: string,
) => {
	if (remainingDays < 0) {
		return t('subscription.expired', { date })
	}

	if (remainingDays === 0) {
		return t('subscription.expiresToday')
	}

	if (remainingDays === 1) {
		return t('subscription.expiresInOneDay')
	}

	return t('subscription.expiresInDays', { count: remainingDays })
}

const PaymentDetails = ({
	settings,
}: {
	settings: SubscriptionPaymentSettings | undefined
}) => {
	const { t } = useTranslation()

	if (!settings) {
		return null
	}

	const hasContact =
		settings.contactName || settings.contactEmail || settings.contactPhone

	return (
		<Stack gap={4}>
			{hasContact ? (
				<Box>
					<Text fontWeight="semibold" mb={2}>
						{t('subscription.superadminContact')}
					</Text>
					{settings.contactName ? (
						<Text>
							{t('subscription.name')}: {settings.contactName}
						</Text>
					) : null}
					{settings.contactEmail ? (
						<Text>
							{t('subscription.email')}: {settings.contactEmail}
						</Text>
					) : null}
					{settings.contactPhone ? (
						<Text>
							{t('subscription.phone')}: {settings.contactPhone}
						</Text>
					) : null}
				</Box>
			) : null}
			<Box>
				<Text fontWeight="semibold" mb={2}>
					{t('subscription.paymentMethods')}
				</Text>
				{settings.methods.length === 0 ? (
					<Text color="gray.600">{t('subscription.noPaymentMethods')}</Text>
				) : (
					<Stack gap={4} divider={<Divider />}>
						{settings.methods.map(method => (
							<Box key={method.id}>
								<Text fontWeight="medium">{method.name}</Text>
								{method.details ? (
									<Text whiteSpace="pre-wrap" mt={1}>
										{method.details}
									</Text>
								) : null}
								{method.qrUrl && isAllowedPaymentQrUrl(method.qrUrl) ? (
									<Image
										src={method.qrUrl}
										alt={t('subscription.qrCode')}
										mt={2}
										maxW="10rem"
									/>
								) : null}
							</Box>
						))}
					</Stack>
				)}
			</Box>
		</Stack>
	)
}

const SubscriptionRenewalBanner = () => {
	const { t, i18n } = useTranslation()
	const { user } = useUser()
	const skip = !user?.tenantId || user.role === UserRole.SUPER_ADMIN
	const { data } = useGetSubscriptionQuery(undefined, { skip })
	const [createRenewalRequest, { isLoading }] =
		useCreateRenewalRequestMutation()
	const [dismissed, setDismissed] = useState(false)
	const [dismissedApproved, setDismissedApproved] = useState(false)
	const [requestError, setRequestError] = useState('')
	const modal = useDisclosure()
	const showToast = useCustomToast()
	const { data: paymentInfo } = useGetSubscriptionPaymentInfoQuery(undefined, {
		skip: skip || !modal.isOpen,
	})
	const subscription = data?.subscription
	const pendingRequest = data?.pendingRequest
	const latestRequest = data?.latestRequest
	const tenantId = user?.tenantId
	const approvedRequest =
		latestRequest?.status === 'approved' ? latestRequest : null
	const approvedStorageKey = approvedRequest
		? `subscription-approved:${approvedRequest.requestId}`
		: ''
	const showApproved =
		Boolean(approvedRequest && approvedStorageKey) &&
		!dismissedApproved &&
		!localStorage.getItem(approvedStorageKey)
	const showExpiry = Boolean(
		subscription && (subscription.warning || subscription.expired),
	)
	const isRejected = latestRequest?.status === 'rejected' && !pendingRequest

	if (
		!tenantId ||
		skip ||
		(!showExpiry && !pendingRequest && !showApproved && !isRejected)
	) {
		return null
	}

	const storageKey = subscription
		? dismissKey(tenantId, subscription.remainingDays)
		: ''

	if (
		!pendingRequest &&
		!showApproved &&
		!isRejected &&
		(dismissed || (storageKey && sessionStorage.getItem(storageKey)))
	) {
		return null
	}

	const date = subscription
		? formatRenewalDate(subscription.renewalDate, i18n.language)
		: ''
	const daysMessage = subscription
		? subscriptionRemainingMessage(t, subscription.remainingDays, date)
		: ''
	const canSubmit = Boolean(subscription?.canRequestRenewal && !pendingRequest)

	const dismiss = () => {
		if (pendingRequest || showApproved || isRejected) {
			return
		}

		if (storageKey) {
			sessionStorage.setItem(storageKey, '1')
		}

		setDismissed(true)
	}

	const dismissApproved = () => {
		if (approvedStorageKey) {
			localStorage.setItem(approvedStorageKey, '1')
		}

		setDismissedApproved(true)
	}

	const submitRequest = () => {
		setRequestError('')
		void createRenewalRequest()
			.unwrap()
			.then(() => {
				modal.onClose()
				showToast({
					status: 'success',
					title: t('subscription.requestSubmittedTitle'),
					description: t('subscription.requestSubmittedBody'),
				})
			})
			.catch(() => {
				setRequestError(t('subscription.requestFailed'))
			})
	}

	const status = pendingRequest
		? 'warning'
		: showApproved
			? 'success'
			: subscription?.urgent || subscription?.expired
				? 'error'
				: 'warning'

	return (
		<Box px={layout.contentPaddingX} pt={2}>
			<Alert status={status} borderRadius="md" variant="left-accent">
				<AlertIcon />
				<Box flex="1">
					<AlertTitle>
						{showApproved && !pendingRequest
							? t('subscription.approvedTitle')
							: t('subscription.renewalTitle')}
					</AlertTitle>
					<AlertDescription display="block">
						{pendingRequest ? (
							<>
								{showExpiry && daysMessage ? `${daysMessage} ` : ''}
								{t('subscription.pendingBody')}
							</>
						) : showApproved ? (
							t('subscription.approvedBody', {
								date: formatRenewalDate(
									subscription?.renewalDate ??
										approvedRequest?.currentExpirationDate ??
										'',
									i18n.language,
								),
							})
						) : (
							daysMessage
						)}
						{!pendingRequest &&
						!showApproved &&
						subscription &&
						subscription.remainingDays >= 0
							? ` ${t('subscription.renewBefore', { date })}`
							: ''}
					</AlertDescription>
					{pendingRequest ? (
						<AlertDescription display="block" mt={1}>
							{t('subscription.status')}: {t('subscription.statusPending')}
						</AlertDescription>
					) : null}
					{isRejected ? (
						<AlertDescription display="block" mt={1}>
							{t('subscription.rejectedBody')}
							{latestRequest?.rejectionReason
								? ` ${latestRequest.rejectionReason}`
								: ''}
						</AlertDescription>
					) : null}
					{requestError ? (
						<AlertDescription display="block" mt={1} color="red.600">
							{requestError}
						</AlertDescription>
					) : null}
					{canSubmit || pendingRequest ? (
						<Button
							mt={2}
							size="sm"
							colorScheme="orange"
							onClick={modal.onOpen}
						>
							{pendingRequest
								? t('subscription.viewPaymentInfo')
								: t('subscription.requestRenewal')}
						</Button>
					) : null}
				</Box>
				{pendingRequest || isRejected ? null : (
					<CloseButton
						alignSelf="flex-start"
						ms={2}
						aria-label={t('subscription.dismiss')}
						onClick={showApproved ? dismissApproved : dismiss}
					/>
				)}
			</Alert>
			<Modal isOpen={modal.isOpen} onClose={modal.onClose} size="lg">
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>{t('subscription.renewalTitle')}</ModalHeader>
					<ModalCloseButton />
					<ModalBody>
						<Stack gap={4}>
							{daysMessage ? <Text>{daysMessage}</Text> : null}
							<Text>{t('subscription.contactIntro')}</Text>
							<PaymentDetails settings={paymentInfo} />
							<Text>{t('subscription.afterPayment')}</Text>
							{pendingRequest ? (
								<Text fontWeight="medium">{t('subscription.pendingBody')}</Text>
							) : null}
						</Stack>
					</ModalBody>
					<ModalFooter>
						<Button me={3} onClick={modal.onClose}>
							{t('common.cancel')}
						</Button>
						{canSubmit ? (
							<Button
								colorScheme="orange"
								isLoading={isLoading}
								onClick={submitRequest}
							>
								{t('subscription.submitRequest')}
							</Button>
						) : null}
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Box>
	)
}

export default SubscriptionRenewalBanner
export { formatRenewalDate }
