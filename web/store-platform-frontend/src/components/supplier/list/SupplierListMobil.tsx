import { Checkbox, Flex } from '@chakra-ui/react'
import { useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import SupplierListItemMobil from './SupplierListItemMobil'
import { mobileVirtuosoStyle } from '../../../theme/layout'
import { useSee } from '../../../shared/hooks/useSee'
import { SEE } from '../../../shared/seeFlags'

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
	const { canSee } = useSee()
	const canDelete = canSee(SEE.suppliersDelete)
	const handleToggle = (id: string) =>
		setOpenId(prev => (prev === id ? null : id))

	return (
		<>
			{canDelete ? (
				<Flex sx={styles.checkboxWrapper}>
					<Checkbox
						isChecked={areAllItemsSelected}
						onChange={onAllItemsSelectedChange}
					/>
				</Flex>
			) : null}

			<Virtuoso
				style={mobileVirtuosoStyle}
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
