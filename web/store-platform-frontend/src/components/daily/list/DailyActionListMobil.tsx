import { Checkbox, Flex, Spinner } from '@chakra-ui/react'
import React, { useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import ListItemMobil from './ListItemMobil'

const styles = {
	listContainer: {
		width: '100%',
		bg: 'white',
		borderRadius: 'xl',
		border: '1px solid',
		borderColor: 'gray.100',
		overflow: 'hidden',
		boxShadow: 'sm',
	},
	checkboxWrapper: {
		width: '100%',
		justifyContent: 'flex-start',
		alignItems: 'center',
		px: { base: 2, md: 4 },
		py: { base: 2, md: 4 },
	},
} satisfies StylesObject
interface DailyActionListMobilProps {
	dailyActions: DailyAction[]
	isLoading: boolean
	onSelect: (id: string) => void
	selectedDailyActionIds: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
	embedded?: boolean
}

const DailyActionListMobil = ({
	dailyActions,
	isLoading,
	onSelect,
	selectedDailyActionIds,
	areAllItemsSelected,
	onAllItemsSelectedChange,
	embedded = false,
}: DailyActionListMobilProps) => {
	const [openId, setOpenId] = useState<string | null>(null)
	const handleToggle = (id: string) =>
		setOpenId(prev => (prev === id ? null : id))

	const renderItem = (dailyAction: DailyAction) => (
		<ListItemMobil
			key={dailyAction.actionId}
			dailyAction={dailyAction}
			isLoading={isLoading}
			onSelect={onSelect}
			selectedDailyActionIds={selectedDailyActionIds}
			areAllItemsSelected={areAllItemsSelected}
			onAllItemsSelectedChange={onAllItemsSelectedChange}
			isOpen={openId === dailyAction.actionId}
			onToggle={() => handleToggle(dailyAction.actionId)}
		/>
	)

	return (
		<Flex sx={styles.listContainer} direction="column">
			{isLoading && (
				<Flex justify="center" py={4}>
					<Spinner size="sm" />
				</Flex>
			)}
			<Flex sx={styles.checkboxWrapper}>
				<Checkbox
					isChecked={areAllItemsSelected}
					onChange={onAllItemsSelectedChange}
				/>
			</Flex>

			{embedded ? (
				dailyActions.map(renderItem)
			) : (
				<Virtuoso
					useWindowScroll
					style={{ width: '100%' }}
					data={dailyActions}
					totalCount={dailyActions.length}
					computeItemKey={(_, dailyAction) =>
						`DailyActionListMobil_item_${dailyAction.actionId}`
					}
					itemContent={(_, dailyAction) => renderItem(dailyAction)}
				/>
			)}
		</Flex>
	)
}

export default DailyActionListMobil
