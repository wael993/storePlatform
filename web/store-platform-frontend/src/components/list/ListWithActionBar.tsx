import { Box, Center, Text, VStack } from '@chakra-ui/react'
import ListActionBar from './ListActionBar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
	const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([])
	const listActivities: Product[] = useMemo(() => {
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
		setSelectedActivityIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])
	const onAllItemsSelectedChange = useCallback(() => {
		setSelectedActivityIds(prevSelectedIds =>
			prevSelectedIds.length === listActivities.length
				? []
				: listActivities.map(a => a.id),
		)
	}, [listActivities])
	const areAllItemsSelected =
		selectedActivityIds.length === listActivities.length

	useEffect(() => {
		setSelectedActivityIds(prevSelectedIds =>
			prevSelectedIds.filter(id =>
				listActivities.some(activity => activity.id === id),
			),
		)
	}, [listActivities])

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

	if ((!listActivities || listActivities.length === 0) && !isLoading) {
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
			{selectedActivityIds.length > 0 && (
				<ListActionBar
					selectedActivities={
						(selectedActivityIds
							.map(id => listActivities?.find(activity => activity.id === id))
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
				// 	activities={listActivities ?? []}
				// 	isLoading={isLoading}
				// 	onSelect={onSelect}
				// 	selectedActivities={selectedActivityIds}
				// 	areAllItemsSelected={areAllItemsSelected}
				// 	onAllItemsSelectedChange={onAllItemsSelectedChange}
				// />
				<ListDesktop
					products={listActivities ?? []}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedProducts={selectedActivityIds}
					areAllItemsSelected={areAllItemsSelected}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			)}
		</VStack>
	)
}
export default ListWithActionBar
