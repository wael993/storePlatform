import { useNavigate } from 'react-router-dom'
import { Tr } from '@chakra-ui/react'
import { useState } from 'react'
import CustomerListItem from './CustomerListItem'

interface CustomerListRowProps {
	customer: Customer
	onSelect: (id: string) => void
	tableRowProps: Record<string, unknown>
	isSelected: boolean
	isLoading: boolean
}
const CustomerListRow = ({
	customer,
	onSelect,
	tableRowProps,
	isSelected,
	isLoading,
}: CustomerListRowProps) => {
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
			onClick={() => navigate(`${customer.customerId}`)}
		>
			<CustomerListItem
				key={customer.customerId}
				customer={customer}
				onSelect={onSelect}
				isSelected={isSelected}
				isHovered={isHovered}
				isLoading={isLoading}
			/>
		</Tr>
	)
}

export default CustomerListRow
