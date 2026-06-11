import { Box, Center, Text, VStack } from '@chakra-ui/react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useCustomToast from '../../common/CustomToast'
import { compareBreakpoint } from '../../../shared/utils'
import { useBreakpoints } from '../../../shared/hooks/useBreakpoints'
import SupplierListActionBar from './SupplierListActionBar'
import SupplierListDesktop from './SupplierListDesktop'

const styles: StylesObject = {
	noActivities: {
		color: '#6F6F6F',
		fontWeight: '700',
		marginTop: '3rem',
	},
}

interface SupplierListWithActionBarProps {
	suppliers?: Supplier[]
	isLoading: boolean
}

const SupplierListWithActionBar = ({
	suppliers,
	isLoading,
}: SupplierListWithActionBarProps) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
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

	if ((!supplierElements || supplierElements.length === 0) && !isLoading) {
		return (
			<Box>
				<Center>
					<Text sx={styles.noActivities}>{t('common.noActivitiesFound')}</Text>
				</Center>
			</Box>
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
		</VStack>
	)
}

export default SupplierListWithActionBar
