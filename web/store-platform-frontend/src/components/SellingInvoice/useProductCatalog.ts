import { useCallback, useEffect, useState } from 'react'

import {
	getProductCatalogState,
	subscribeProductCatalog,
	syncFromNetwork,
	type ProductCatalogState,
} from '../../offline/productCatalogStore'
import { useUser } from '../../shared/hooks/useUser'

export const useProductCatalog = () => {
	const { user } = useUser()
	const tenantId = user?.tenantId
	const [state, setState] = useState<ProductCatalogState>(getProductCatalogState())

	useEffect(() => subscribeProductCatalog(setState), [])

	const refetch = useCallback(async () => {
		if (!tenantId) return
		await syncFromNetwork(tenantId)
	}, [tenantId])

	return {
		products: state.products,
		indexes: state.indexes,
		isReady: state.isReady,
		isSyncing: state.isSyncing,
		refetch,
	}
}

export {
	mapCatalogItemToProduct,
	mapProductToCatalogItem,
} from './catalogMappers'
