import { useEffect, useState } from 'react'

import {
	getSelectedWarehouseIds,
	initWarehouseScope,
	setSelectedWarehouseIds,
	subscribeWarehouseScope,
} from '../warehouseScope'
import { useUser } from './useUser'

export const useWarehouseScope = () => {
	const { user, userId } = useUser()
	const tenantId = user?.tenantId
	const [selectedWarehouseIds, setSelectedWarehouseIdsState] = useState<
		string[]
	>(() => getSelectedWarehouseIds())

	useEffect(() => {
		initWarehouseScope(tenantId, userId)
	}, [tenantId, userId])

	useEffect(() => subscribeWarehouseScope(setSelectedWarehouseIdsState), [])

	return {
		selectedWarehouseIds,
		setSelectedWarehouseIds,
	}
}
