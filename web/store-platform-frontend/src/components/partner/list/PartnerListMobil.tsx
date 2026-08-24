import { Checkbox, Flex } from '@chakra-ui/react'
import { useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import PartnerListItemMobil from './PartnerListItemMobil'
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
	const { canSee } = useSee()
	const canDelete = canSee(SEE.partnersDelete)
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
