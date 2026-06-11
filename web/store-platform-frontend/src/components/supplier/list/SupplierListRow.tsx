import { useNavigate } from 'react-router-dom'
import { Tr } from '@chakra-ui/react'
import { useState } from 'react'
import SupplierListItem from './SupplierListItem'

interface SupplierListRowProps {
	supplier: Supplier
	onSelect: (id: string) => void
	tableRowProps: Record<string, unknown>
	isSelected: boolean
	isLoading: boolean
}
const SupplierListRow = ({
	supplier,
	onSelect,
	tableRowProps,
	isSelected,
	isLoading,
}: SupplierListRowProps) => {
	const [isHovered, setIsHovered] = useState(false)
	const navigate = useNavigate()
	const styles: StylesObject = {
		row: {
			backgroundColor: isHovered ? '#F9F9F9' : '#FFFFFF',
			cursor: 'pointer',
		},
	}

	console.log('🚀 ~ SupplierListRow ~ supplier:', supplier)
	return (
		<Tr
			{...tableRowProps}
			sx={styles.row}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={() => navigate(`${supplier.supplierId}`)}
		>
			<SupplierListItem
				key={supplier.supplierId}
				supplier={supplier}
				onSelect={onSelect}
				isSelected={isSelected}
				isHovered={isHovered}
				isLoading={isLoading}
			/>
			{/* <ListItem
				key={supplier.supplierId}
				supplier={supplier}
				onSelect={onSelect}
				isSelected={isSelected}
				isHovered={isHovered}
				isLoading={isLoading}
			/> */}
		</Tr>
	)
}

export default SupplierListRow
