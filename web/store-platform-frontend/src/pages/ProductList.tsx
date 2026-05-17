import { Box, VStack, Text, HStack, Button, Spinner } from '@chakra-ui/react'
import { useGetProductsQuery } from '../api/apiStore'

const ProductList = ({ addToCart }: { addToCart: (p: ProductApi) => void }) => {
	const { data: products = [], isFetching, error } = useGetProductsQuery({})

	return (
		<Box>
			<Text fontWeight="bold" mb={2}>
				All Products
			</Text>

			{isFetching && <Spinner />}
			{error && <Text color="red.500">Failed to load</Text>}

			<VStack align="stretch">
				{products.map(p => (
					<HStack key={p._id} p={2} border="1px solid" borderRadius="md">
						<Text flex={2}>{p.name}</Text>
						<Text flex={1}>
							{(p.price?.retailSale ?? 0).toFixed(2)}{' '}
							{p.price?.currency ?? 'EUR'}
						</Text>
						<Text flex={1}>Stock: {p.stock?.quantity ?? 0}</Text>
						<Button
							size="xs"
							onClick={() => addToCart(p)}
							isDisabled={(p.stock?.quantity ?? 0) <= 0}
						>
							Add
						</Button>
					</HStack>
				))}
			</VStack>
		</Box>
	)
}

export default ProductList
