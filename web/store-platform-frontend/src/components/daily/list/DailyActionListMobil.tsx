import {
	Accordion,
	AccordionButton,
	AccordionIcon,
	AccordionItem,
	Checkbox,
	Flex,
} from '@chakra-ui/react'
import React, { useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import ListItemMobil from './ListItemMobil'

const styles = {
	checkboxWrapper: {
		width: '100%',
		justifyContent: 'flex-start',
		alignItems: 'center',
		p: 4,
	},
} satisfies StylesObject
interface DailyActionListMobilProps {
	dailyActions: DailyAction[]
	isLoading: boolean
	onSelect: (id: string) => void
	selectedDailyActionIds: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const DailyActionListMobil = ({
	dailyActions,
	isLoading,
	onSelect,
	selectedDailyActionIds,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: DailyActionListMobilProps) => {
	const [openId, setOpenId] = useState<string | null>(null)
	const handleToggle = (id: string) =>
		setOpenId(prev => (prev === id ? null : id))
	return (
		<>
			<Flex sx={styles.checkboxWrapper}>
				<Checkbox
					isChecked={areAllItemsSelected}
					onChange={onAllItemsSelectedChange}
				/>
			</Flex>

			<Virtuoso
				style={{ height: '100vh', width: '100%' }}
				data={dailyActions}
				totalCount={dailyActions.length}
				computeItemKey={(_, dailyAction) =>
					`DailyActionListMobil_item_${dailyAction.actionId}`
				}
				itemContent={(_, dailyAction) => (
					<ListItemMobil
						dailyAction={dailyAction}
						isLoading={isLoading}
						onSelect={onSelect}
						selectedDailyActionIds={selectedDailyActionIds}
						areAllItemsSelected={areAllItemsSelected}
						onAllItemsSelectedChange={onAllItemsSelectedChange}
						isOpen={openId === dailyAction.actionId}
						onToggle={() => handleToggle(dailyAction.actionId)}
					/>
				)}
			/>
		</>
	)
}

export default DailyActionListMobil
