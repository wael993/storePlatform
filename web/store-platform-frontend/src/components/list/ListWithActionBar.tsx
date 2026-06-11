import { Box, Center, Text, VStack } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ListActionBar from './ListActionBar'
import { useBreakpoints } from '../../shared/hooks/useBreakpoints'
import { compareBreakpoint } from '../../shared/utils'
import ListDesktop from './ListDesktop'
import useCustomToast from '../common/CustomToast'

const styles: StylesObject = {
	noActivities: {
		color: '#6F6F6F',
		fontWeight: '700',
		marginTop: '3rem',
	},
}

interface ListWithActionBarProps {
	products?: Product[]
	isLoading: boolean
}

const ListWithActionBar = ({ products, isLoading }: ListWithActionBarProps) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
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

	const onAddRequiredDocument = async (
		selectedActivities: Product[],
		data: {},
	) => {
		const succeededActivities: string[] = []
		for (const activity of selectedActivities) {
			const eventType = 'PROMO'
			try {
				// await addRequiredDocument({
				// 	activityId: activity.id,
				// 	data,
				// 	eventType,
				// }).unwrap()
				// succeededActivities.push(activity.id)
				// if (succeededActivities.length === selectedActivities.length) {
				// 	showToastMessage({
				// 		status: 'success',
				// 		description: t('components.list.multiAddRequiredDocumentSuccess'),
				// 	})
				// }
			} catch (error) {
				showToastMessage({
					status: 'error',
					description: t('components.list.multiAddRequiredDocumentError', {
						count: selectedActivities.length - succeededActivities.length,
						total: selectedActivities.length,
					}),
				})
				break
			}
		}

		// await invalidateTags({ tags: ['Activities'] })
	}

	if ((!productElements || productElements.length === 0) && !isLoading) {
		return (
			<Box>
				<Center>
					<Text sx={styles.noActivities}>{t('common.noActivitiesFound')}</Text>
				</Center>
			</Box>
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
					isRejectActivityInProgress={false}
					onAddRequiredDocument={onAddRequiredDocument}
					isAddRequiredDocumentInProgress={false}
					// onChangeDocumentsDeadlines={onChangeDocumentsDeadlines}
				/>
			)}
			{isMobile ? (
				<></>
			) : (
				// <ListMobile
				// 	activities={productElements ?? []}
				// 	isLoading={isLoading}
				// 	onSelect={onSelect}
				// 	selectedActivities={selectedProductsIds}
				// 	areAllItemsSelected={areAllItemsSelected}
				// 	onAllItemsSelectedChange={onAllItemsSelectedChange}
				// />
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
export default ListWithActionBar
