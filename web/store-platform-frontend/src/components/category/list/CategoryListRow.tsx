import { Tr } from '@chakra-ui/react'
import { useState } from 'react'
import CategoryListItem from './CategoryListItem'

interface CategoryListRowProps {
	category: Category
	onSelect: (id: string) => void
	tableRowProps: Record<string, unknown>
	isSelected: boolean
	isLoading: boolean
}

const CategoryListRow = ({
	category,
	onSelect,
	tableRowProps,
	isSelected,
	isLoading,
}: CategoryListRowProps) => {
	const [isHovered, setIsHovered] = useState(false)
	const styles: StylesObject = {
		row: {
			backgroundColor: isHovered ? '#F9F9F9' : '#FFFFFF',
		},
	}

	return (
		<Tr
			{...tableRowProps}
			sx={styles.row}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<CategoryListItem
				key={category.categoryId}
				category={category}
				onSelect={onSelect}
				isSelected={isSelected}
				isHovered={isHovered}
				isLoading={isLoading}
			/>
		</Tr>
	)
}

export default CategoryListRow
