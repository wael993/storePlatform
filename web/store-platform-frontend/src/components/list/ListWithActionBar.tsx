import { Box, Center, Text, VStack } from '@chakra-ui/react'
import ListActionBar from './ListActionBar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '../../shared/hooks/useUser'
import { useBreakpoints } from '../../shared/hooks/useBreakpoints'
import { compareBreakpoint } from '../../shared/utils'
// import ListMobile from './ListMobile'
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
	activities?: ProductApi[]
	isLoading: boolean
	eventType: 'PROMO' | 'SAMPLING'
}

export type ListActivity = ProductApi
const ListWithActionBar = ({
	activities,
	isLoading,
	eventType,
}: ListWithActionBarProps) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const { user } = useUser()
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([])
	const listActivities: ListActivity[] = useMemo(() => {
		return (
			activities?.map((activity: ProductApi) => {
				return {
					...activity,
					isSelectable: true,
				}
			}) || []
		)
	}, [activities, user])

	const onSelect = useCallback((activityId: string) => {
		setSelectedActivityIds(prev =>
			prev.includes(activityId)
				? prev.filter(id => id !== activityId)
				: [...prev, activityId],
		)
	}, [])
	const onAllItemsSelectedChange = useCallback(() => {
		console.log(listActivities.length)
		setSelectedActivityIds(prevSelectedIds =>
			prevSelectedIds.length === listActivities.length
				? []
				: listActivities.map(a => a._id),
		)
	}, [listActivities])
	const areAllItemsSelected =
		selectedActivityIds.length === listActivities.length

	useEffect(() => {
		setSelectedActivityIds(prevSelectedIds =>
			prevSelectedIds.filter(id =>
				listActivities.some(activity => activity._id === id),
			),
		)
	}, [listActivities])

	const onAddRequiredDocument = async (
		selectedActivities: ListActivity[],
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
							.map(id => listActivities?.find(activity => activity._id === id))
							.filter(Boolean) as ListActivity[]) ?? []
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
					activities={listActivities ?? []}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedActivities={selectedActivityIds}
					areAllItemsSelected={areAllItemsSelected}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			)}
		</VStack>
	)
}
export default ListWithActionBar
