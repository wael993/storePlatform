import { Box, VStack } from '@chakra-ui/react'
import { useState } from 'react'

import BarcodeScanner from './BarcodeScanner'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { BreadCrumbItem } from '../shared/globalEnums'
import { generateBreadcrumbs } from '../shared/routes'
import DailyActionsListWithActionBar from '../components/daily/list/DailyActionsListWithActionBar'
import { useGetDailyActionsQuery } from '../api/apiStore'

export type StoreCartItem = Product & {
	cartQuantity: number
}

const BarcodePage = () => {
	const [_card, setCart] = useState<StoreCartItem[]>([])
	const breadCrumbItems = generateBreadcrumbs()

	const { data: dailyActions = [], isLoading: isDailyActionsLoading } =
		useGetDailyActionsQuery({})

	const addToCart = (p: Product) => {
		setCart(prev => {
			const existing = prev.find(item => item.productId === p.productId)
			const maxStock = p.stock?.quantity ?? 0

			if (existing) {
				if (existing.cartQuantity >= maxStock) {
					return prev
				}

				return prev.map(item =>
					item.productId === p.productId
						? {
								...item,
								cartQuantity: item.cartQuantity + 1,
							}
						: item,
				)
			}

			if (maxStock <= 0) {
				return prev
			}

			return [...prev, { ...p, cartQuantity: 1 }]
		})
	}

	return (
		<Box p={6}>
			<VStack gap={6} align="stretch">
				<CustomBreadcrumb items={breadCrumbItems[BreadCrumbItem.BARCODE]} />
				<BarcodeScanner addToCart={addToCart} />

				<DailyActionsListWithActionBar
					dailyActions={dailyActions}
					isLoading={isDailyActionsLoading}
				/>

				{/* <ProductList addToCart={addToCart} /> */}

				{/* (optional) Cart Component later */}
			</VStack>
		</Box>
	)
}

export default BarcodePage
