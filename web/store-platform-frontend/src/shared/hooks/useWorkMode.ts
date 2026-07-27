import { useCallback, useEffect, useState } from 'react'

import {
	bootstrapOfflineData,
	enterOfflineWorkMode,
	exitOfflineWorkMode,
	getOfflineState,
	initOfflineState,
	subscribeOfflineState,
} from '../../offline/syncService'
import { getIsNetworkOnline } from '../../offline/connectivity'
import {
	getWorkMode,
	getWorkModePreference,
	loadWorkModePreference,
	setWorkMode,
	setWorkModePreference,
	subscribeWorkMode,
	subscribeWorkModePreference,
	type WorkMode,
	type WorkModePreference,
} from '../../offline/workMode'
import { isOfflineEnabledForTenant } from '../../offline/offlineTenantAccess'
import { useUser } from './useUser'

export const useWorkMode = () => {
	const { user } = useUser()
	const tenantId = user?.tenantId
	const offlineEnabled = isOfflineEnabledForTenant(tenantId)

	const [workModePreference, setWorkModePreferenceState] =
		useState<WorkModePreference>(() => getWorkModePreference())
	const [workMode, setWorkModeState] = useState<WorkMode>(() => getWorkMode())
	const [isSwitching, setIsSwitching] = useState(false)
	const [switchError, setSwitchError] = useState<string | null>(null)
	const [syncState, setSyncState] = useState(getOfflineState().syncState)

	useEffect(() => {
		void loadWorkModePreference().then(preference =>
			setWorkModePreferenceState(preference),
		)
	}, [tenantId])

	useEffect(() => subscribeWorkModePreference(setWorkModePreferenceState), [])
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

	const switchWorkModePreference = useCallback(
		async (nextPreference: WorkModePreference) => {
			if (!tenantId || !offlineEnabled || nextPreference === workModePreference) {
				return
			}

			setIsSwitching(true)
			setSwitchError(null)

			const previousPreference = workModePreference

			try {
				if (nextPreference === 'auto') {
					await bootstrapOfflineData(tenantId)
					await setWorkMode(getIsNetworkOnline() ? 'online' : 'offline')
					await initOfflineState(tenantId)
					await setWorkModePreference('auto')
				} else if (nextPreference === 'offline') {
					await enterOfflineWorkMode(tenantId)
					await setWorkModePreference('offline')
				} else {
					await exitOfflineWorkMode(tenantId)
					await setWorkModePreference('online')
				}
			} catch (error) {
				await setWorkModePreference(previousPreference)
				const message =
					error instanceof Error ? error.message : 'Failed to switch work mode'
				setSwitchError(message)
				throw error
			} finally {
				setIsSwitching(false)
			}
		},
		[tenantId, offlineEnabled, workModePreference],
	)

	return {
		workMode,
		workModePreference,
		offlineEnabled,
		isSwitching,
		switchError,
		syncState,
		switchWorkModePreference,
	}
}
