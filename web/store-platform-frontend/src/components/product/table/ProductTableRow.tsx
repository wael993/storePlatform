import { useNavigate } from 'react-router-dom'
import { Tr } from '@chakra-ui/react'
import { useState } from 'react'
import TableItem from './ProductTableItem'

interface ProductTableRowProps {
	product: Product
	onSelect: (id: string) => void
	onEditProduct: (product: Product) => void
	tableRowProps: Record<string, unknown>
	isSelected: boolean
	isLoading: boolean
}

const ProductTableRow = ({
	product,
	onSelect,
	onEditProduct,
	isSelected,
	tableRowProps,
	isLoading,
}: ProductTableRowProps) => {
	const [isHovered, setIsHovered] = useState(false)
	const navigate = useNavigate()
	const styles: StylesObject = {
		row: {
			backgroundColor: isHovered ? '#F9F9F9' : '#FFFFFF',
			cursor: 'pointer',
			borderBottom: '1px solid #EAEAEA',
		},
	}

	return (
		<Tr
			{...tableRowProps}
			sx={styles.row}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={() => navigate(`${product.productId}`)}
		>
			<TableItem
				key={product.productId}
				product={product}
				onSelect={onSelect}
				onEditProduct={onEditProduct}
				isSelected={isSelected}
				isHovered={isHovered}
				isLoading={isLoading}
			/>
		</Tr>
	)
}

export default ProductTableRow
