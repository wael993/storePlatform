import { Box, VStack } from '@chakra-ui/react'
import { useState, useMemo } from 'react'
import ProductList from './ProductList'
import BarcodeScanner from './BarcodeScanner'
import AddProductForm from './AddProductForm'

export type StoreCartItem = ProductApi & {
	cartQuantity: number
}

const BarcodePage = () => {
	const [cart, setCart] = useState<StoreCartItem[]>([])

	const addToCart = (p: ProductApi) => {
		setCart(prev => {
			const existing = prev.find(item => item._id === p._id)

			if (existing) {
				return prev.map(item =>
					item._id === p._id
						? {
								...item,
								cartQuantity: Math.min(item.cartQuantity + 1, item.count),
							}
						: item,
				)
			}

			return [...prev, { ...p, cartQuantity: 1 }]
		})
	}

	const clearCart = () => setCart([])

	const total = useMemo(() => {
		return cart.reduce((sum, item) => sum + item.price * item.cartQuantity, 0)
	}, [cart])

	return (
		<Box p={6}>
			<VStack gap={6} align="stretch">
				<BarcodeScanner addToCart={addToCart} />
				{/* <ProductList addToCart={addToCart} /> */}
				{/* <AddProductForm /> */}

				{/* (optional) Cart Component later */}
			</VStack>
		</Box>
	)
}

export default BarcodePage
