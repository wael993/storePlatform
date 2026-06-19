import { Checkbox, Flex } from '@chakra-ui/react'
import { useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import ListItemMobil from './ListItemMobil'
import { mobileVirtuosoStyle } from '../../theme/layout'

const styles = {
	checkboxWrapper: {
		width: '100%',
		justifyContent: 'flex-start',
		alignItems: 'center',
		p: 4,
	},
} satisfies StylesObject

interface ListMobilProps {
	products: Product[]
	isLoading: boolean
	onSelect: (id: string) => void
	selectedProducts: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const ListMobil = ({
	products,
	isLoading,
	onSelect,
	selectedProducts,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: ListMobilProps) => {
	const [openId, setOpenId] = useState<string | null>(null)
	const handleToggle = (id: string) =>
		setOpenId(prev => (prev === id ? null : id))

	return (
		<>
			<Flex sx={styles.checkboxWrapper}>
				<Checkbox
					isChecked={areAllItemsSelected}
					onChange={onAllItemsSelectedChange}
				/>
			</Flex>

			<Virtuoso
				style={mobileVirtuosoStyle}
				data={products}
				totalCount={products.length}
				computeItemKey={(_, product) =>
					`ProductListMobil_item_${product.productId}`
				}
				itemContent={(_, product) => (
					<ListItemMobil
						product={product}
						isLoading={isLoading}
						onSelect={onSelect}
						selectedProducts={selectedProducts}
						isOpen={openId === product.productId}
						onToggle={() => handleToggle(product.productId)}
					/>
				)}
			/>
		</>
	)
}

export default ListMobil
