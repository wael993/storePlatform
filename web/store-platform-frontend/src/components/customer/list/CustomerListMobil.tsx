import { Checkbox, Flex } from '@chakra-ui/react'
import { useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import CustomerListItemMobil from './CustomerListItemMobil'
import { mobileVirtuosoStyle } from '../../../theme/layout'

const styles = {
	checkboxWrapper: {
		width: '100%',
		justifyContent: 'flex-start',
		alignItems: 'center',
		p: 4,
	},
} satisfies StylesObject

interface CustomerListMobilProps {
	customers: Customer[]
	isLoading: boolean
	onSelect: (id: string) => void
	selectedCustomers: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const CustomerListMobil = ({
	customers,
	isLoading,
	onSelect,
	selectedCustomers,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: CustomerListMobilProps) => {
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
				style={mobileVirtuosoStyle}
				data={customers}
				totalCount={customers.length}
				computeItemKey={(_, customer) =>
					`CustomerListMobil_item_${customer.customerId}`
				}
				itemContent={(_, customer) => (
					<CustomerListItemMobil
						customer={customer}
						isLoading={isLoading}
						onSelect={onSelect}
						selectedCustomers={selectedCustomers}
						isOpen={openId === customer.customerId}
						onToggle={() => handleToggle(customer.customerId)}
					/>
				)}
			/>
		</>
	)
}

export default CustomerListMobil
