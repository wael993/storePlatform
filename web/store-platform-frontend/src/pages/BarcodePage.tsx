import { Box, VStack } from '@chakra-ui/react'
import { useState } from 'react'
import ProductList from './ProductList'
import BarcodeScanner from './BarcodeScanner'

export type StoreCartItem = Product & {
	cartQuantity: number
}

const BarcodePage = () => {
	const [, setCart] = useState<StoreCartItem[]>([])

	const addToCart = (p: Product) => {
		setCart(prev => {
			const existing = prev.find(item => item.id === p.id)
			const maxStock = p.stock?.quantity ?? 0

			if (existing) {
				if (existing.cartQuantity >= maxStock) {
					return prev
				}

				return prev.map(item =>
					item.id === p.id
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
				<BarcodeScanner addToCart={addToCart} />
				<ProductList addToCart={addToCart} />

				{/* (optional) Cart Component later */}
			</VStack>
		</Box>
	)
}

export default BarcodePage
