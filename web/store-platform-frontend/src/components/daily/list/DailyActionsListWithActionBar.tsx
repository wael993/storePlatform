import { VStack } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DailyListActionBar from './DailyActionsListActionBar'
import DailyActionListDesktop from './DailyActionListDesktop'
import EmptyState from '../../common/EmptyState'
import { compareBreakpoint } from '../../../shared/utils'
import { useBreakpoints } from '../../../shared/hooks/useBreakpoints'
import DailyActionListMobil from './DailyActionListMobil'

interface DailyActionsListWithActionBarProps {
	dailyActions: DailyAction[]
	isLoading: boolean
	embedded?: boolean
}

const DailyActionsListWithActionBar = ({
	dailyActions,
	isLoading,
	embedded = false,
}: DailyActionsListWithActionBarProps) => {
	const { t } = useTranslation()
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
				: dailyActionElements.map(a => a._id ?? a.actionId)
		})
	}, [dailyActionElements])

	useEffect(() => {
		setSelectedDailyActionIds(prevSelectedIds =>
			prevSelectedIds.filter(id =>
				dailyActionElements.some(
					dailyAction => dailyAction._id === id || dailyAction.actionId === id,
				),
			),
		)
	}, [dailyActionElements])

	if (
		(!dailyActionElements || dailyActionElements.length === 0) &&
		!isLoading
	) {
		return (
			<EmptyState
				title={t('common.emptyStateTitle')}
				description={t('common.emptyStateDescription')}
			/>
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
									dailyAction =>
										dailyAction.actionId === id || dailyAction._id === id,
								),
							)
							.filter(Boolean) as DailyAction[]) ?? []
					}
					isRejectActivityInProgress={false}
					onAddRequiredDocument={() => Promise.resolve()}
					isAddRequiredDocumentInProgress={false}
				/>
			)}

			{isMobile ? (
				<DailyActionListMobil
					dailyActions={dailyActionElements}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedDailyActionIds={selectedDailyActionIds}
					areAllItemsSelected={
						selectedDailyActionIds.length === dailyActionElements.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
					embedded={embedded}
				/>
			) : (
				<DailyActionListDesktop
					dailyActions={dailyActionElements}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedDailyActionIds={selectedDailyActionIds}
					areAllItemsSelected={
						selectedDailyActionIds.length === dailyActionElements.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
					embedded={embedded}
				/>
			)}
		</VStack>
	)
}

export default DailyActionsListWithActionBar
