import { useState } from 'react'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	AlertTitle,
	Box,
	Button,
	CloseButton,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { UserRole } from '../shared/globalEnums'
import { useUser } from '../shared/hooks/useUser'
import {
	useGetSubscriptionQuery,
	useRenewSubscriptionMutation,
} from '../api/apiStore'
import { layout } from '../theme/layout'

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

const SubscriptionRenewalBanner = () => {
	const { t, i18n } = useTranslation()
	const { user } = useUser()
	const skip = !user?.tenantId || user.role === UserRole.SUPER_ADMIN
	const { data } = useGetSubscriptionQuery(undefined, { skip })
	const [renewSubscription, { isLoading }] = useRenewSubscriptionMutation()
	const [dismissed, setDismissed] = useState(false)
	const [renewError, setRenewError] = useState('')
	const subscription = data?.subscription
	const tenantId = user?.tenantId

	if (
		!tenantId ||
		skip ||
		!subscription ||
		(!subscription.warning && !subscription.expired)
	) {
		return null
	}

	const storageKey = dismissKey(tenantId, subscription.remainingDays)

	if (dismissed || sessionStorage.getItem(storageKey)) {
		return null
	}

	const date = formatRenewalDate(subscription.renewalDate, i18n.language)
	const daysMessage = subscriptionRemainingMessage(
		t,
		subscription.remainingDays,
		date,
	)

	const dismiss = () => {
		sessionStorage.setItem(storageKey, '1')
		setDismissed(true)
	}

	return (
		<Box px={layout.contentPaddingX} pt={2}>
			<Alert
				status={subscription.urgent || subscription.expired ? 'error' : 'warning'}
				borderRadius="md"
				variant="left-accent"
			>
				<AlertIcon />
				<Box flex="1">
					<AlertTitle>{t('subscription.renewalTitle')}</AlertTitle>
					<AlertDescription display="block">
						{daysMessage}
						{subscription.remainingDays >= 0
							? ` ${t('subscription.renewBefore', { date })}`
							: ''}
					</AlertDescription>
					{renewError ? (
						<AlertDescription display="block" mt={1} color="red.600">
							{renewError}
						</AlertDescription>
					) : null}
					{subscription.canRenew ? (
						<Button
							mt={2}
							size="sm"
							colorScheme="orange"
							isLoading={isLoading}
							onClick={() => {
								setRenewError('')
								void renewSubscription()
									.unwrap()
									.catch(() => {
										setRenewError(t('tenants.renewFailed'))
									})
							}}
						>
							{t('subscription.renew')}
						</Button>
					) : null}
				</Box>
				<CloseButton
					alignSelf="flex-start"
					ms={2}
					aria-label={t('subscription.dismiss')}
					onClick={dismiss}
				/>
			</Alert>
		</Box>
	)
}

export default SubscriptionRenewalBanner
export { formatRenewalDate }
