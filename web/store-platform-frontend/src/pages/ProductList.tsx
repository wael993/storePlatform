import { Box, VStack, Text, HStack, Button, Spinner } from '@chakra-ui/react'
import { useGetProductsQuery } from '../api/apiStore'
import { useTranslation } from 'react-i18next'

const ProductList = ({ addToCart }: { addToCart: (p: Product) => void }) => {
	const { t } = useTranslation()
	const { data: response, isFetching, error } = useGetProductsQuery({})
	const products = response?.products ?? []

	return (
		<Box>
			<Text fontWeight="bold" mb={2}>
				{t('products.allProducts')}
			</Text>

			{isFetching && <Spinner />}
			{error && <Text color="red.500">{t('products.loadFailed')}</Text>}

			<VStack align="stretch">
				{products.map(p => (
					<HStack key={p.productId} p={2} border="1px solid" borderRadius="md">
						<Text flex={2}>{p.name}</Text>
						<Text flex={1}>
							{(p.price?.retailSale ?? 0).toFixed(2)}{' '}
							{p.price?.currency ?? 'EUR'}
						</Text>
						<Text flex={1}>
							{t('products.stockValue', { stock: p.stock?.quantity ?? 0 })}
						</Text>
						<Button
							size="xs"
							onClick={() => addToCart(p)}
							isDisabled={(p.stock?.quantity ?? 0) <= 0}
						>
							{t('common.add')}
						</Button>
					</HStack>
				))}
			</VStack>
		</Box>
	)
}

export default ProductList
