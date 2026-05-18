import { useNavigate } from 'react-router-dom'
import { Tr } from '@chakra-ui/react'
import ListItem from './ListItem'
import { useState } from 'react'
// import { ListActivity } from './ListWithActionBar'

interface ListRowProps {
	product: Product
	onSelect: (id: string) => void
	tableRowProps: Record<string, unknown>
	isSelected: boolean
	isLoading: boolean
}

const ListRow = ({
	product,
	onSelect,
	isSelected,
	tableRowProps,
	isLoading,
}: ListRowProps) => {
	const [isHovered, setIsHovered] = useState(false)
	const navigate = useNavigate()
	const styles: StylesObject = {
		row: {
			backgroundColor: isHovered ? '#F9F9F9' : '#FFFFFF',
			cursor: 'pointer',
		},
	}

	return (
		<Tr
			{...tableRowProps}
			sx={styles.row}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={() => navigate(`${product.id}`)}
		>
			<ListItem
				key={product.id}
				product={product}
				onSelect={onSelect}
				isSelected={isSelected}
				isHovered={isHovered}
				isLoading={isLoading}
			/>
		</Tr>
	)
}

export default ListRow
