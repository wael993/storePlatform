import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import useCustomToast from '../../components/common/CustomToast'
import type { OfflineState } from '../../offline/types'

const SYNC_PUSH_TOAST_ID = 'sync-push-toast'

/** useOfflineSync mounts in multiple places; toast at most once per transition. */
let lastEmittedKey = ''

const emitOnce = (key: string, emit: () => void) => {
	if (lastEmittedKey === key) return
	lastEmittedKey = key
	emit()
}

export const useSyncPushNotifications = ({
	syncState,
	syncPushResult,
}: Pick<OfflineState, 'syncState' | 'syncPushResult'>) => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const previousSyncState = useRef(syncState)
	const showToastRef = useRef(showToast)
	const tRef = useRef(t)
	showToastRef.current = showToast
	tRef.current = t

	useEffect(() => {
		const prev = previousSyncState.current
		const enteredSyncing = syncState === 'syncing' && prev !== 'syncing'
		const leftSyncing = prev === 'syncing' && syncState !== 'syncing'

		if (enteredSyncing) {
			emitOnce('syncing', () => {
				showToastRef.current({
					id: SYNC_PUSH_TOAST_ID,
					title: tRef.current('offline.pushInProgress'),
					description: tRef.current('offline.pushInProgressDescription'),
					status: 'loading',
					duration: null,
					isClosable: false,
				})
			})
		} else if (leftSyncing && syncState === 'success' && syncPushResult) {
			emitOnce(`success:${syncPushResult.syncedCount}`, () => {
				showToastRef.current({
					id: SYNC_PUSH_TOAST_ID,
					title: tRef.current('offline.pushSuccess'),
					description: tRef.current('offline.pushSuccessDescription', {
						count: syncPushResult.syncedCount,
					}),
					status: 'success',
					duration: 6000,
					isClosable: true,
				})
			})
		} else if (
			leftSyncing &&
			syncState === 'error' &&
			syncPushResult?.type === 'partial'
		) {
			emitOnce(
				`partial:${syncPushResult.syncedCount}:${syncPushResult.failedCount}`,
				() => {
					showToastRef.current({
						id: SYNC_PUSH_TOAST_ID,
						title: tRef.current('offline.pushPartialFailed'),
						description: tRef.current('offline.pushPartialFailedDescription', {
							synced: syncPushResult.syncedCount,
							failed: syncPushResult.failedCount,
						}),
						status: 'warning',
						duration: 8000,
						isClosable: true,
					})
				},
			)
		} else if (leftSyncing && syncState === 'error' && syncPushResult) {
			emitOnce(`failed:${syncPushResult.errorMessage ?? ''}`, () => {
				showToastRef.current({
					id: SYNC_PUSH_TOAST_ID,
					title: tRef.current('offline.pushFailed'),
					description:
						syncPushResult.errorMessage ??
						tRef.current('offline.pushFailedDescription'),
					status: 'error',
					duration: 8000,
					isClosable: true,
				})
			})
		}

		previousSyncState.current = syncState
	}, [syncState, syncPushResult])
}
