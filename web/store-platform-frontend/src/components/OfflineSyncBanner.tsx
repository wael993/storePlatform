import {
	Alert,
	AlertDescription,
	AlertIcon,
	Box,
	Button,
	Flex,
	Spinner,
	Text,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

import { useInsufficientStockConfirmation } from '../shared/hooks/useInsufficientStockConfirmation'
import { useOfflineSync } from '../shared/hooks/useOfflineSync'
import { useUser } from '../shared/hooks/useUser'
import InsufficientStockModal from './InsufficientStockModal'
import SyncConflictModal from './SyncConflictModal'

const OfflineSyncBanner = () => {
	const { t } = useTranslation()
	const { user } = useUser()
	const {
		isOnline,
		syncState,
		pendingCount,
		lastError,
		isOfflineCapable,
		offlineEnabled,
		syncPushResult,
		bootstrap,
		sync,
		conflicts,
		clearConflicts,
	} = useOfflineSync(user?.tenantId)
	const {
		isOpen: isInsufficientStockOpen,
		items: insufficientStockItems,
		confirm: confirmInsufficientStock,
		cancel: cancelInsufficientStock,
	} = useInsufficientStockConfirmation()

	const handleBootstrap = async () => {
		try {
			await bootstrap()
		} catch {
			// Error state handled by sync service
		}
	}

	const handleSync = async () => {
		try {
			await sync()
		} catch {
			// Error state handled by sync service
		}
	}

	if (!user?.tenantId || !offlineEnabled) return null

	const showOfflineBanner = !isOnline || !isOfflineCapable
	const isPushing = syncState === 'syncing'
	const isBootstrapping = syncState === 'bootstrapping'
	const isSyncing = isPushing || isBootstrapping
	const pushSucceeded = syncState === 'success'
	const pushFailed =
		isOnline && syncState === 'error' && syncPushResult !== null

	console.log('🚀 ~ OfflineSyncBanner ~ isOfflineCapable:', isOfflineCapable)
	return (
		<>
			<Box px={{ base: 3, md: 4 }} pt={2}>
				{showOfflineBanner && (
					<Alert
						status={isOnline ? 'info' : 'warning'}
						borderRadius="md"
						mb={2}
						variant="left-accent"
					>
						<AlertIcon />
						<AlertDescription flex="1">
							{!isOfflineCapable
								? t('offline.bootstrapRequired')
								: t('offline.workingOffline', { count: pendingCount })}
						</AlertDescription>
						{isOnline && !isOfflineCapable && (
							<Button
								size="sm"
								colorScheme="blue"
								ml={3}
								onClick={handleBootstrap}
								isLoading={isBootstrapping}
							>
								{t('offline.syncNow')}
							</Button>
						)}
					</Alert>
				)}

				{isPushing && (
					<Alert status="info" borderRadius="md" mb={2} variant="left-accent">
						<Spinner size="sm" mr={3} />
						<AlertDescription flex="1">
							<Text fontWeight={600}>{t('offline.pushInProgress')}</Text>
							<Text fontSize="sm">
								{t('offline.pushInProgressDescription')}
							</Text>
						</AlertDescription>
					</Alert>
				)}

				{pushSucceeded && syncPushResult && (
					<Alert
						status="success"
						borderRadius="md"
						mb={2}
						variant="left-accent"
					>
						<AlertIcon />
						<AlertDescription>
							<Text fontWeight={600}>{t('offline.pushSuccess')}</Text>
							<Text fontSize="sm">
								{t('offline.pushSuccessDescription', {
									count: syncPushResult.syncedCount,
								})}
							</Text>
						</AlertDescription>
					</Alert>
				)}

				{pushFailed && (
					<Alert status="error" borderRadius="md" mb={2} variant="left-accent">
						<AlertIcon />
						<AlertDescription flex="1">
							<Text fontWeight={600}>
								{syncPushResult?.type === 'partial'
									? t('offline.pushPartialFailed')
									: t('offline.pushFailed')}
							</Text>
							<Text fontSize="sm">
								{syncPushResult?.type === 'partial'
									? t('offline.pushPartialFailedDescription', {
											synced: syncPushResult.syncedCount,
											failed: syncPushResult.failedCount,
										})
									: (syncPushResult?.errorMessage ??
										lastError ??
										t('offline.pushFailedDescription'))}
							</Text>
						</AlertDescription>
						{pendingCount > 0 && (
							<Button
								size="sm"
								colorScheme="red"
								variant="outline"
								ml={3}
								onClick={handleSync}
								isLoading={isSyncing}
							>
								{t('offline.retryPush')}
							</Button>
						)}
					</Alert>
				)}

				{isOfflineCapable &&
					isOnline &&
					pendingCount > 0 &&
					!isPushing &&
					!pushSucceeded && (
						<Alert status="info" borderRadius="md" mb={2} variant="left-accent">
							<AlertIcon />
							<Flex flex="1" align="center" justify="space-between" gap={3}>
								<Text fontSize="sm">
									{t('offline.pendingChanges', { count: pendingCount })}
								</Text>
								<Button
									size="sm"
									colorScheme="blue"
									onClick={handleSync}
									isLoading={isSyncing}
								>
									{t('offline.pushChanges')}
								</Button>
							</Flex>
						</Alert>
					)}

				{isBootstrapping && (
					<Flex align="center" gap={2} mb={2} fontSize="sm" color="gray.600">
						<Spinner size="sm" />
						<Text>{t('offline.downloadingData')}</Text>
					</Flex>
				)}

				{/* {isOfflineCapable &&
					lastSyncedAt &&
					!showOfflineBanner &&
					pendingCount === 0 &&
					syncState === 'idle' && (
						<Text fontSize="xs" color="gray.500" mb={1}>
							{t('offline.lastSynced', {
								time: new Date(lastSyncedAt).toLocaleString(),
							})}
						</Text>
					)} */}
			</Box>
			<SyncConflictModal
				isOpen={conflicts.length > 0}
				conflicts={conflicts}
				onClose={clearConflicts}
			/>
			<InsufficientStockModal
				isOpen={isInsufficientStockOpen}
				items={insufficientStockItems}
				onConfirm={confirmInsufficientStock}
				onCancel={cancelInsufficientStock}
			/>
		</>
	)
}

export default OfflineSyncBanner
