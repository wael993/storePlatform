import { VStack, useDisclosure } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ListActionBar from './ProductTableActionBar'
import { useBreakpoints } from '../../../shared/hooks/useBreakpoints'
import { compareBreakpoint } from '../../../shared/utils'
import ListDesktop from './ProductTableDesktop'
import EmptyState from '../../common/EmptyState'
import ListMobil from './ProductTableMobil'
import AddProductModal from '../../../pages/AddProductModal'
import WarehouseTransferModal from '../WarehouseTransferModal'

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
	const [editingProduct, setEditingProduct] = useState<Product | null>(null)
	const [transferProducts, setTransferProducts] = useState<Product[]>([])
	const {
		isOpen: isEditOpen,
		onOpen: onEditOpen,
		onClose: onEditClose,
	} = useDisclosure()
	const {
		isOpen: isTransferOpen,
		onOpen: onTransferOpen,
		onClose: onTransferClose,
	} = useDisclosure()
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

	const onEditProduct = useCallback(
		(product: Product) => {
			setEditingProduct(product)
			onEditOpen()
		},
		[onEditOpen],
	)

	const onMovementProducts = useCallback(
		(nextProducts: Product[]) => {
			setTransferProducts(nextProducts)
			onTransferOpen()
		},
		[onTransferOpen],
	)

	const onMovementProduct = useCallback(
		(product: Product) => onMovementProducts([product]),
		[onMovementProducts],
	)

	const handleEditClose = useCallback(() => {
		onEditClose()
		setEditingProduct(null)
	}, [onEditClose])

	const handleTransferClose = useCallback(() => {
		onTransferClose()
		setTransferProducts([])
	}, [onTransferClose])

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
					onMovementProducts={onMovementProducts}
				/>
			)}
			{isMobile ? (
				<ListMobil
					products={productElements ?? []}
					isLoading={isLoading}
					onSelect={onSelect}
					onEditProduct={onEditProduct}
					onMovementProduct={onMovementProduct}
					selectedProducts={selectedProductsIds}
					areAllItemsSelected={areAllItemsSelected}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			) : (
				<ListDesktop
					products={productElements ?? []}
					isLoading={isLoading}
					onSelect={onSelect}
					onEditProduct={onEditProduct}
					onMovementProduct={onMovementProduct}
					selectedProducts={selectedProductsIds}
					areAllItemsSelected={areAllItemsSelected}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			)}
			<AddProductModal
				isOpen={isEditOpen}
				onClose={handleEditClose}
				barcode={editingProduct?.barcode ?? ''}
				product={editingProduct ?? undefined}
				onSuccess={handleEditClose}
			/>
			<WarehouseTransferModal
				products={transferProducts}
				isOpen={isTransferOpen}
				onClose={handleTransferClose}
			/>
		</VStack>
	)
}
export default ProductTableWithActionBar
