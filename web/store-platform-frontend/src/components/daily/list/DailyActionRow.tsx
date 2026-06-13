import { Tr } from '@chakra-ui/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DailyActionItem from './DailyActionItem'
import { buildRoutePath } from '../../../shared/routes'

interface DailyActionRowProps {
	dailyAction: DailyAction
	onSelect: (id: string) => void
	tableRowProps: Record<string, unknown>
	isSelected: boolean
	isLoading: boolean
}

const DailyActionRow = ({
	dailyAction,
	onSelect,
	isSelected,
	tableRowProps,
	isLoading,
}: DailyActionRowProps) => {
	const [isHovered, setIsHovered] = useState(false)
	const navigate = useNavigate()
	const targetPath = dailyAction.supplierId
		? buildRoutePath.supplierById(dailyAction.supplierId)
		: dailyAction.customerId
			? buildRoutePath.customerById(dailyAction.customerId)
			: undefined
	const canNavigateToRelatedParty = !isLoading && Boolean(targetPath)

	const styles: StylesObject = {
		row: {
			backgroundColor: isHovered ? '#F9F9F9' : '#FFFFFF',
			cursor: canNavigateToRelatedParty ? 'pointer' : 'default',
		},
	}

	return (
		<Tr
			{...tableRowProps}
			sx={styles.row}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={() => {
				if (!targetPath || !canNavigateToRelatedParty) return
				navigate(targetPath)
			}}
		>
			<DailyActionItem
				key={dailyAction._id ?? dailyAction.actionId}
				dailyAction={dailyAction}
				onSelect={onSelect}
				isSelected={isSelected}
				isHovered={isHovered}
				isLoading={isLoading}
			/>
		</Tr>
	)
}

export default DailyActionRow
