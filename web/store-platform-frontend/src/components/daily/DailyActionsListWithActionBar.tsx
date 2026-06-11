import { Box, Center, Text, VStack } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DailyListActionBar from './DailyActionsListActionBar'
import useCustomToast from '../common/CustomToast'
import { useBreakpoints } from '../../shared/hooks/useBreakpoints'
import { compareBreakpoint } from '../../shared/utils'
import DailyActionListDesktop from './DailyActionListDesktop'

const styles: StylesObject = {
	noActivities: {
		color: '#6F6F6F',
		fontWeight: '700',
		marginTop: '3rem',
	},
}

interface DailyActionsListWithActionBarProps {
	dailyActions: DailyAction[]
	isLoading: boolean
}

const DailyActionsListWithActionBar = ({
	dailyActions,
	isLoading,
}: DailyActionsListWithActionBarProps) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const [selectedDailyActionIds, setSelectedDailyActionIds] = useState<
		string[]
	>([])

	const dailyActionElements: DailyAction[] = useMemo(() => {
		return (
			dailyActions?.map((dailyAction: DailyAction) => {
				return {
					...dailyAction,
					isSelectable: true,
				}
			}) || []
		)
	}, [dailyActions])

	const onSelect = useCallback((id: string) => {
		setSelectedDailyActionIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])

	const onAllItemsSelectedChange = useCallback(() => {
		setSelectedDailyActionIds(prevSelectedIds => {
			return prevSelectedIds.length === dailyActionElements.length
				? []
				: dailyActionElements.map(a => a.actionId)
		})
	}, [dailyActionElements])

	useEffect(() => {
		setSelectedDailyActionIds(prevSelectedIds =>
			prevSelectedIds.filter(id =>
				dailyActionElements.some(dailyAction => dailyAction.actionId === id),
			),
		)
	}, [dailyActionElements])

	if (
		(!dailyActionElements || dailyActionElements.length === 0) &&
		!isLoading
	) {
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
			{selectedDailyActionIds.length > 0 && (
				<DailyListActionBar
					selectedDailies={
						(selectedDailyActionIds
							.map(id =>
								dailyActionElements?.find(
									dailyAction => dailyAction.actionId === id,
								),
							)
							.filter(Boolean) as DailyAction[]) ?? []
					}
					isRejectActivityInProgress={false}
					onAddRequiredDocument={() => Promise.resolve()}
					isAddRequiredDocumentInProgress={false}
				/>
			)}

			<DailyActionListDesktop
				dailyActions={dailyActionElements}
				isLoading={isLoading}
				onSelect={onSelect}
				selectedDailyActionIds={selectedDailyActionIds}
				areAllItemsSelected={
					selectedDailyActionIds.length === dailyActionElements.length
				}
				onAllItemsSelectedChange={onAllItemsSelectedChange}
			/>
		</VStack>
	)
}

export default DailyActionsListWithActionBar
