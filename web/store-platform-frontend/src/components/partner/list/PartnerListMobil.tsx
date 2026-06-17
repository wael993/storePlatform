import { Checkbox, Flex } from '@chakra-ui/react'
import { useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import PartnerListItemMobil from './PartnerListItemMobil'

const styles = {
	checkboxWrapper: {
		width: '100%',
		justifyContent: 'flex-start',
		alignItems: 'center',
		p: 4,
	},
} satisfies StylesObject

interface PartnerListMobilProps {
	partners: Partner[]
	isLoading: boolean
	onSelect: (id: string) => void
	selectedPartners: string[]
	areAllItemsSelected: boolean
	onAllItemsSelectedChange: () => void
}

const PartnerListMobil = ({
	partners,
	isLoading,
	onSelect,
	selectedPartners,
	areAllItemsSelected,
	onAllItemsSelectedChange,
}: PartnerListMobilProps) => {
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
				data={partners}
				totalCount={partners.length}
				computeItemKey={(_, partner) =>
					`PartnerListMobil_item_${partner.partnerId}`
				}
				itemContent={(_, partner) => (
					<PartnerListItemMobil
						partner={partner}
						isLoading={isLoading}
						onSelect={onSelect}
						selectedPartners={selectedPartners}
						isOpen={openId === partner.partnerId}
						onToggle={() => handleToggle(partner.partnerId)}
					/>
				)}
			/>
		</>
	)
}

export default PartnerListMobil
