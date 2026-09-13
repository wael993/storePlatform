import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { storeApi, useGetWarehousesQuery } from '../../api/apiStore'
import { useUser } from './useUser'
import {
	getWarehouseScopeIds,
	setWarehouseScopeIds,
	subscribeWarehouseScope,
	syncWarehouseScopeWithAccessible,
} from '../warehouseScope'

const SCOPE_INVALIDATE_TAGS = [
	'products',
	'product',
	'inventory',
	'selling-invoices',
	'buying-invoices',
	'daily-actions',
	'customers',
	'suppliers',
] as const

export const useWarehouseScope = () => {
	const { user, isOwner } = useUser()
	const dispatch = useDispatch()
	const { data: warehouses = [], isSuccess } = useGetWarehousesQuery(
		undefined,
		{
			skip: !user?.userId,
		},
	)
	const [selectedIds, setSelectedIds] = useState(getWarehouseScopeIds)

	useEffect(() => subscribeWarehouseScope(setSelectedIds), [])

	useEffect(() => {
		if (!isSuccess || !user?.userId) return

		const accessibleIds = warehouses.map(w => w.warehouseId)
		const prev = getWarehouseScopeIds().join(',')
		const next = syncWarehouseScopeWithAccessible(
			user.tenantId,
			user.userId,
			accessibleIds,
		).join(',')

		if (prev !== next) {
			dispatch(storeApi.util.invalidateTags([...SCOPE_INVALIDATE_TAGS]))
			const tenantId = user.tenantId
			void import('../../offline/productCatalogStore').then(
				({ syncFromNetwork }) => syncFromNetwork(tenantId),
			)
		}
	}, [isSuccess, warehouses, user?.tenantId, user?.userId, dispatch])

	const setSelectedWarehouseIds = (ids: string[]) => {
		if (ids.length === 0) return
		const prev = getWarehouseScopeIds().join(',')
		setWarehouseScopeIds(ids)
		if (prev !== ids.join(',')) {
			dispatch(storeApi.util.invalidateTags([...SCOPE_INVALIDATE_TAGS]))
			const tenantId = user?.tenantId
			if (tenantId) {
				void import('../../offline/productCatalogStore').then(
					({ syncFromNetwork }) => syncFromNetwork(tenantId),
				)
			}
		}
	}

	return {
		warehouses,
		selectedWarehouseIds: selectedIds,
		setSelectedWarehouseIds,
		isOperational: selectedIds.length === 1,
		operationalWarehouseId: selectedIds.length === 1 ? selectedIds[0] : null,
		isOwner,
		hasMultipleAccessible: warehouses.length > 1,
		isWarehousesReady: isSuccess,
	}
}
