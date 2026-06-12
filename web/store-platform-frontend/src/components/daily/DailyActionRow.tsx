import { Tr } from '@chakra-ui/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DailyActionItem from './DailyActionItem'

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

	const styles: StylesObject = {
		row: {
			backgroundColor: isHovered ? '#F9F9F9' : '#FFFFFF',
			cursor: 'default',
		},
	}

	return (
		<Tr
			{...tableRowProps}
			sx={styles.row}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={() => navigate('/services/store_platform/suppliers')}
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
