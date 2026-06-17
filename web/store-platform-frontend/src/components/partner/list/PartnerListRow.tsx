import { useNavigate } from 'react-router-dom'
import { Tr } from '@chakra-ui/react'
import { useState } from 'react'
import PartnerListItem from './PartnerListItem'
import { buildRoutePath } from '../../../shared/routes'

interface PartnerListRowProps {
	partner: Partner
	onSelect: (id: string) => void
	tableRowProps: Record<string, unknown>
	isSelected: boolean
	isLoading: boolean
}
const PartnerListRow = ({
	partner,
	onSelect,
	tableRowProps,
	isSelected,
	isLoading,
}: PartnerListRowProps) => {
	const [isHovered, setIsHovered] = useState(false)
	const navigate = useNavigate()
	const styles: StylesObject = {
		row: {
			backgroundColor: isHovered ? '#F9F9F9' : '#FFFFFF',
			cursor: 'pointer',
		},
	}

	return (
		<Tr
			{...tableRowProps}
			sx={styles.row}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={() => navigate(buildRoutePath.partnerById(partner.partnerId))}
		>
			<PartnerListItem
				key={partner.partnerId}
				partner={partner}
				onSelect={onSelect}
				isSelected={isSelected}
				isHovered={isHovered}
				isLoading={isLoading}
			/>
		</Tr>
	)
}

export default PartnerListRow
