import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import useCustomToast from '../../components/common/CustomToast'
import type { OfflineState } from '../../offline/types'

const SYNC_PUSH_TOAST_ID = 'sync-push-toast'

export const useSyncPushNotifications = ({
	syncState,
	syncPushResult,
}: Pick<OfflineState, 'syncState' | 'syncPushResult'>) => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const previousSyncState = useRef(syncState)

	useEffect(() => {
		const wasSyncing = previousSyncState.current === 'syncing'

		if (syncState === 'syncing') {
			showToast({
				id: SYNC_PUSH_TOAST_ID,
				title: t('offline.pushInProgress'),
				description: t('offline.pushInProgressDescription'),
				status: 'loading',
				duration: null,
				isClosable: false,
			})
		} else if (wasSyncing && syncState === 'success' && syncPushResult) {
			showToast({
				id: SYNC_PUSH_TOAST_ID,
				title: t('offline.pushSuccess'),
				description: t('offline.pushSuccessDescription', {
					count: syncPushResult.syncedCount,
				}),
				status: 'success',
				duration: 6000,
				isClosable: true,
			})
		} else if (
			wasSyncing &&
			syncState === 'error' &&
			syncPushResult?.type === 'partial'
		) {
			showToast({
				id: SYNC_PUSH_TOAST_ID,
				title: t('offline.pushPartialFailed'),
				description: t('offline.pushPartialFailedDescription', {
					synced: syncPushResult.syncedCount,
					failed: syncPushResult.failedCount,
				}),
				status: 'warning',
				duration: 8000,
				isClosable: true,
			})
		} else if (wasSyncing && syncState === 'error' && syncPushResult) {
			showToast({
				id: SYNC_PUSH_TOAST_ID,
				title: t('offline.pushFailed'),
				description:
					syncPushResult.errorMessage ?? t('offline.pushFailedDescription'),
				status: 'error',
				duration: 8000,
				isClosable: true,
			})
		}

		previousSyncState.current = syncState
	}, [syncState, syncPushResult, showToast, t])
}
