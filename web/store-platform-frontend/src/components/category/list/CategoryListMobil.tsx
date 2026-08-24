import { Checkbox, Flex } from '@chakra-ui/react'
import { useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import CategoryListItemMobil from './CategoryListItemMobil'
import { mobileVirtuosoStyle } from '../../../theme/layout'
import { useSee } from '../../../shared/hooks/useSee'
import { SEE } from '../../../shared/seeFlags'

const styles = {
	checkboxWrapper: {
		width: '100%',
		justifyContent: 'flex-start',
		alignItems: 'center',
		p: 4,
	},
} satisfies StylesObject

interface CategoryListMobilProps {
	categories: Category[]
	isLoading: boolean
	onSelect: (id: string) => void
	selectedCategories: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const CategoryListMobil = ({
	categories,
	isLoading,
	onSelect,
	selectedCategories,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: CategoryListMobilProps) => {
	const [openId, setOpenId] = useState<string | null>(null)
	const { canSee } = useSee()
	const canDelete = canSee(SEE.categoriesDelete)
	const handleToggle = (id: string) =>
		setOpenId(prev => (prev === id ? null : id))

	return (
		<>
			{canDelete ? (
				<Flex sx={styles.checkboxWrapper}>
					<Checkbox
						isChecked={areAllItemsSelected}
						onChange={onAllItemsSelectedChange}
					/>
				</Flex>
			) : null}

			<Virtuoso
				style={mobileVirtuosoStyle}
				data={categories}
				totalCount={categories.length}
				computeItemKey={(_, category) =>
					`CategoryListMobil_item_${category.categoryId}`
				}
				itemContent={(_, category) => (
					<CategoryListItemMobil
						category={category}
						isLoading={isLoading}
						onSelect={onSelect}
						selectedCategories={selectedCategories}
						isOpen={openId === category.categoryId}
						onToggle={() => handleToggle(category.categoryId)}
					/>
				)}
			/>
		</>
	)
}

export default CategoryListMobil
