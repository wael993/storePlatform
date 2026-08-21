import { VStack } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ListActionBar from './ProductTableActionBar'
import { useBreakpoints } from '../../../shared/hooks/useBreakpoints'
import { compareBreakpoint } from '../../../shared/utils'
import ListDesktop from './ProductTableDesktop'
import EmptyState from '../../common/EmptyState'
import ListMobil from './ProductTableMobil'

interface ProductTableWithActionBarProps {
	products?: Product[]
	isLoading: boolean
}

const ProductTableWithActionBar = ({
	products,
	isLoading,
}: ProductTableWithActionBarProps) => {
	const { t } = useTranslation()
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const [selectedProductsIds, setSelectedProductsIds] = useState<string[]>([])
	const productElements: Product[] = useMemo(() => {
		return (
			products?.map((product: Product) => {
				return {
					...product,
					isSelectable: true,
				}
			}) || []
		)
	}, [products])

	const onSelect = useCallback((id: string) => {
		setSelectedProductsIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])
	const onAllItemsSelectedChange = useCallback(() => {
		setSelectedProductsIds(prevSelectedIds => {
			return prevSelectedIds.length === productElements.length
				? []
				: productElements.map(a => a.productId)
		})
	}, [productElements])
	const areAllItemsSelected =
		selectedProductsIds.length === productElements.length

	useEffect(() => {
		setSelectedProductsIds(prevSelectedIds =>
			prevSelectedIds.filter(id =>
				productElements.some(activity => activity.productId === id),
			),
		)
	}, [productElements])

	if ((!productElements || productElements.length === 0) && !isLoading) {
		return (
			<EmptyState
				title={t('common.emptyStateTitle')}
				description={t('common.emptyStateDescription')}
			/>
		)
	}

	return (
		<VStack w="100%" p={0}>
			{selectedProductsIds.length > 0 && (
				<ListActionBar
					selectedActivities={
						(selectedProductsIds
							.map(id =>
								productElements?.find(activity => activity.productId === id),
							)
							.filter(Boolean) as Product[]) ?? []
					}
				/>
			)}
			{isMobile ? (
				<ListMobil
					products={productElements ?? []}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedProducts={selectedProductsIds}
					areAllItemsSelected={areAllItemsSelected}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			) : (
				<ListDesktop
					products={productElements ?? []}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedProducts={selectedProductsIds}
					areAllItemsSelected={areAllItemsSelected}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			)}
		</VStack>
	)
}
export default ProductTableWithActionBar
