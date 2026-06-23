import { VStack } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CategoryListDesktop from './CategoryListDesktop'
import EmptyState from '../../common/EmptyState'
import { compareBreakpoint } from '../../../shared/utils'
import { useBreakpoints } from '../../../shared/hooks/useBreakpoints'
import CategoryListActionBar from './CategoryListActionBar'
import CategoryListMobil from './CategoryListMobil'

interface CategoryListWithActionBarProps {
	categories?: Category[]
	isLoading: boolean
}

const CategoryListWithActionBar = ({
	categories,
	isLoading,
}: CategoryListWithActionBarProps) => {
	const { t } = useTranslation()
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
	const categoryElements: Category[] = useMemo(() => {
		return (
			categories?.map((category: Category) => {
				return {
					...category,
					isSelectable: true,
				}
			}) || []
		)
	}, [categories])

	const onSelect = useCallback((id: string) => {
		setSelectedCategoryIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])

	const onAllItemsSelectedChange = useCallback(() => {
		setSelectedCategoryIds(prevSelectedIds =>
			prevSelectedIds.length === categoryElements.length
				? []
				: categoryElements.map(a => a.categoryId),
		)
	}, [categoryElements])

	useEffect(() => {
		setSelectedCategoryIds(prevSelectedIds =>
			prevSelectedIds.filter(id =>
				categoryElements.some(category => category.categoryId === id),
			),
		)
	}, [categoryElements])

	if ((!categoryElements || categoryElements.length === 0) && !isLoading) {
		return (
			<EmptyState
				title={t('common.emptyStateTitle')}
				description={t('common.emptyStateDescription')}
			/>
		)
	}

	return (
		<VStack w="100%" p={0}>
			{selectedCategoryIds.length > 0 && (
				<CategoryListActionBar
					selectedCategorys={
						(selectedCategoryIds
							.map(id =>
								categoryElements?.find(category => category.categoryId === id),
							)
							.filter(Boolean) as Category[]) ?? []
					}
					isRejectActivityInProgress={false}
					onAddRequiredDocument={() => Promise.resolve()}
					isAddRequiredDocumentInProgress={false}
				/>
			)}
			{isMobile ? (
				<CategoryListMobil
					categories={categoryElements}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedCategories={selectedCategoryIds}
					areAllItemsSelected={
						selectedCategoryIds.length === categoryElements.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			) : (
				<CategoryListDesktop
					categories={categoryElements}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedCategories={selectedCategoryIds}
					areAllItemsSelected={
						selectedCategoryIds.length === categoryElements.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			)}
		</VStack>
	)
}

export default CategoryListWithActionBar
