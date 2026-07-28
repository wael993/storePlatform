import { useEffect, useMemo, useState } from 'react'

import { useGetInventoryQuery, type InventoryItem } from '../../api/apiStore'
import { offlineDb } from '../../offline/db'
import { useUser } from '../../shared/hooks/useUser'
import { mapInventoryByProductId } from './invoiceApiMappers'

export const useInventoryByProductId = () => {
	const { user } = useUser()
	const tenantId = user?.tenantId
	const { data: inventory = [] } = useGetInventoryQuery(undefined, {
		skip: !tenantId,
	})
	const [offlineInventory, setOfflineInventory] = useState<InventoryItem[]>([])

	useEffect(() => {
		if (!tenantId || inventory.length > 0) {
			setOfflineInventory([])
			return
		}

		let cancelled = false

		void offlineDb.inventory.toArray().then(items => {
			if (cancelled || items.length === 0) return
			setOfflineInventory(items)
		})

		return () => {
			cancelled = true
		}
	}, [tenantId, inventory])

	const source = inventory.length > 0 ? inventory : offlineInventory

	return useMemo(() => mapInventoryByProductId(source), [source])
}
