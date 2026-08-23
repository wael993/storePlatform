import { VStack } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PartnerListDesktop from './PartnerListDesktop'
import EmptyState from '../../common/EmptyState'
import { compareBreakpoint } from '../../../shared/utils'
import { useBreakpoints } from '../../../shared/hooks/useBreakpoints'
import PartnerListActionBar from './PartnerListActionBar'
import PartnerListMobil from './PartnerListMobil'
import { useSee } from '../../../shared/hooks/useSee'
import { SEE } from '../../../shared/seeFlags'

interface PartnerListWithActionBarProps {
	partners?: Partner[]
	isLoading: boolean
}

const PartnerListWithActionBar = ({
	partners,
	isLoading,
}: PartnerListWithActionBarProps) => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const canDelete = canSee(SEE.partnersDelete)
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([])
	const partnerElements: Partner[] = useMemo(() => {
		return (
			partners?.map((partner: Partner) => {
				return {
					...partner,
					isSelectable: true,
				}
			}) || []
		)
	}, [partners])

	const onSelect = useCallback((id: string) => {
		setSelectedPartnerIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])

	const onAllItemsSelectedChange = useCallback(() => {
		setSelectedPartnerIds(prevSelectedIds =>
			prevSelectedIds.length === partnerElements.length
				? []
				: partnerElements.map(a => a.partnerId),
		)
	}, [partnerElements])

	useEffect(() => {
		setSelectedPartnerIds(prevSelectedIds =>
			prevSelectedIds.filter(id =>
				partnerElements.some(partner => partner.partnerId === id),
			),
		)
	}, [partnerElements])

	if ((!partnerElements || partnerElements.length === 0) && !isLoading) {
		return (
			<EmptyState
				title={t('common.emptyStateTitle')}
				description={t('common.emptyStateDescription')}
			/>
		)
	}

	return (
		<VStack w="100%" p={0}>
			{canDelete && selectedPartnerIds.length > 0 && (
				<PartnerListActionBar
					selectedPartners={
						(selectedPartnerIds
							.map(id =>
								partnerElements?.find(partner => partner.partnerId === id),
							)
							.filter(Boolean) as Partner[]) ?? []
					}
				/>
			)}
			{isMobile ? (
				<PartnerListMobil
					partners={partnerElements}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedPartners={selectedPartnerIds}
					areAllItemsSelected={
						selectedPartnerIds.length === partnerElements.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			) : (
				<PartnerListDesktop
					partners={partnerElements}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedPartners={selectedPartnerIds}
					areAllItemsSelected={
						selectedPartnerIds.length === partnerElements.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			)}
		</VStack>
	)
}

export default PartnerListWithActionBar
