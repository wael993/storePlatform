import { useCallback, useEffect, useState } from 'react'

import {
	enterOfflineWorkMode,
	exitOfflineWorkMode,
	getOfflineState,
	subscribeOfflineState,
} from '../../offline/syncService'
import {
	getWorkMode,
	loadWorkMode,
	subscribeWorkMode,
	type WorkMode,
} from '../../offline/workMode'
import { isOfflineEnabledForTenant } from '../../offline/offlineTenantAccess'
import { useUser } from './useUser'

export const useWorkMode = () => {
	const { user } = useUser()
	const tenantId = user?.tenantId
	const offlineEnabled = isOfflineEnabledForTenant(tenantId)

	const [workMode, setWorkModeState] = useState<WorkMode>(() => getWorkMode())
	const [isSwitching, setIsSwitching] = useState(false)
	const [switchError, setSwitchError] = useState<string | null>(null)
	const [syncState, setSyncState] = useState(getOfflineState().syncState)

	useEffect(() => {
		void loadWorkMode().then(mode => setWorkModeState(mode))
	}, [tenantId])

	useEffect(() => subscribeWorkMode(setWorkModeState), [])

	useEffect(
		() =>
			subscribeOfflineState(partial => {
				if (partial.syncState !== undefined) {
					setSyncState(partial.syncState)
				}
			}),
		[],
	)

	const switchWorkMode = useCallback(
		async (nextMode: WorkMode) => {
			if (!tenantId || !offlineEnabled || nextMode === workMode) return

			setIsSwitching(true)
			setSwitchError(null)

			try {
				if (nextMode === 'offline') {
					await enterOfflineWorkMode(tenantId)
				} else {
					await exitOfflineWorkMode(tenantId)
				}
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Failed to switch work mode'
				setSwitchError(message)
				throw error
			} finally {
				setIsSwitching(false)
			}
		},
		[tenantId, offlineEnabled, workMode],
	)

	return {
		workMode,
		offlineEnabled,
		isSwitching,
		switchError,
		syncState,
		switchWorkMode,
	}
}
