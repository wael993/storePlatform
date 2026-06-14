import { VStack } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SupplierListActionBar from './SupplierListActionBar'
import SupplierListDesktop from './SupplierListDesktop'
import { TargetType } from '../../../shared/globalEnums'
import EmptyState from '../../common/EmptyState'
import { compareBreakpoint } from '../../../shared/utils'
import { useBreakpoints } from '../../../shared/hooks/useBreakpoints'
import SupplierListMobil from './SupplierListMobil'

interface SupplierListWithActionBarProps {
	suppliers?: Supplier[]
	isLoading: boolean
	targetType?: TargetType
}

const SupplierListWithActionBar = ({
	suppliers,
	isLoading,
}: SupplierListWithActionBarProps) => {
	const { t } = useTranslation()
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([])
	const supplierElements: Supplier[] = useMemo(() => {
		return (
			suppliers?.map((supplier: Supplier) => {
				return {
					...supplier,
					isSelectable: true,
				}
			}) || []
		)
	}, [suppliers])

	const onSelect = useCallback((id: string) => {
		setSelectedSupplierIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])

	const onAllItemsSelectedChange = useCallback(() => {
		setSelectedSupplierIds(prevSelectedIds =>
			prevSelectedIds.length === supplierElements.length
				? []
				: supplierElements.map(a => a.supplierId),
		)
	}, [supplierElements])

	useEffect(() => {
		setSelectedSupplierIds(prevSelectedIds =>
			prevSelectedIds.filter(id =>
				supplierElements.some(supplier => supplier.supplierId === id),
			),
		)
	}, [supplierElements])

	if ((!supplierElements || supplierElements.length === 0) && !isLoading) {
		return (
			<EmptyState
				title={t('common.emptyStateTitle')}
				description={t('common.emptyStateDescription')}
			/>
		)
	}

	return (
		<VStack w="100%" p={0}>
			{selectedSupplierIds.length > 0 && (
				<SupplierListActionBar
					selectedSuppliers={
						(selectedSupplierIds
							.map(id =>
								supplierElements?.find(supplier => supplier.supplierId === id),
							)
							.filter(Boolean) as Supplier[]) ?? []
					}
					isRejectActivityInProgress={false}
					onAddRequiredDocument={() => Promise.resolve()}
					isAddRequiredDocumentInProgress={false}
				/>
			)}
			{isMobile ? (
				<SupplierListMobil
					suppliers={supplierElements}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedSuppliers={selectedSupplierIds}
					areAllItemsSelected={
						selectedSupplierIds.length === supplierElements.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			) : (
				<SupplierListDesktop
					suppliers={supplierElements}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedSuppliers={selectedSupplierIds}
					areAllItemsSelected={
						selectedSupplierIds.length === supplierElements.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			)}
		</VStack>
	)
}

export default SupplierListWithActionBar
