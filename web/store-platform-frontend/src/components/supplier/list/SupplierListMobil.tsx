import { Checkbox, Flex } from '@chakra-ui/react'
import { useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import SupplierListItemMobil from './SupplierListItemMobil'

const styles = {
	checkboxWrapper: {
		width: '100%',
		justifyContent: 'flex-start',
		alignItems: 'center',
		p: 4,
	},
} satisfies StylesObject

interface SupplierListMobilProps {
	suppliers: Supplier[]
	isLoading: boolean
	onSelect: (id: string) => void
	selectedSuppliers: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const SupplierListMobil = ({
	suppliers,
	isLoading,
	onSelect,
	selectedSuppliers,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: SupplierListMobilProps) => {
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
				data={suppliers}
				totalCount={suppliers.length}
				computeItemKey={(_, supplier) =>
					`SupplierListMobil_item_${supplier.supplierId}`
				}
				itemContent={(_, supplier) => (
					<SupplierListItemMobil
						supplier={supplier}
						isLoading={isLoading}
						onSelect={onSelect}
						selectedSuppliers={selectedSuppliers}
						isOpen={openId === supplier.supplierId}
						onToggle={() => handleToggle(supplier.supplierId)}
					/>
				)}
			/>
		</>
	)
}

export default SupplierListMobil
