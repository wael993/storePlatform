import React from 'react'
import { useTranslation } from 'react-i18next'
import {
	FormControl,
	FormLabel,
	Radio,
	RadioGroup,
	Stack,
	VStack,
} from '@chakra-ui/react'

interface ProductsSettingsProps {
	productsPerPage: number
	handleProductsPerPageChange: (value: string) => void
}

const ProductsSettings = ({
	productsPerPage,
	handleProductsPerPageChange,
}: ProductsSettingsProps) => {
	const { t } = useTranslation()

	return (
		<VStack align="stretch" spacing={6} width="100%">
			<FormControl>
				<FormLabel fontWeight={600} mb={4}>
					{t('components.productsSettings.productsPerPage')}
				</FormLabel>
				<RadioGroup
					value={productsPerPage === 1000 ? 'all' : productsPerPage.toString()}
					onChange={handleProductsPerPageChange}
				>
					<Stack spacing={3}>
						<Radio value="20">20 products per page</Radio>
						<Radio value="100">100 products per page</Radio>
						<Radio value="all">Show all products</Radio>
					</Stack>
				</RadioGroup>
			</FormControl>
		</VStack>
	)
}

export default ProductsSettings
