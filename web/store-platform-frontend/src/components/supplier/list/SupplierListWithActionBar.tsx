import {
	Box,
	Icon,
	Input,
	InputGroup,
	InputLeftElement,
	VStack,
} from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SupplierListActionBar from './SupplierListActionBar'
import SupplierListDesktop from './SupplierListDesktop'
import { TargetType } from '../../../shared/globalEnums'
import EmptyState from '../../common/EmptyState'
import { compareBreakpoint } from '../../../shared/utils'
import { useBreakpoints } from '../../../shared/hooks/useBreakpoints'
import SupplierListMobil from './SupplierListMobil'
import { matchesNameOrCode } from '../../list/shared/utils'
import { AsSearchIcon } from '../../../icons/Search'

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
	const [searchText, setSearchText] = useState('')
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

	const filteredSuppliers = useMemo(
		() =>
			supplierElements.filter(supplier =>
				matchesNameOrCode(supplier, searchText),
			),
		[supplierElements, searchText],
	)

	const onSelect = useCallback((id: string) => {
		setSelectedSupplierIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])

	const onAllItemsSelectedChange = useCallback(() => {
		setSelectedSupplierIds(prevSelectedIds =>
			prevSelectedIds.length === filteredSuppliers.length
				? []
				: filteredSuppliers.map(a => a.supplierId),
		)
	}, [filteredSuppliers])

	useEffect(() => {
		setSelectedSupplierIds(prevSelectedIds =>
			prevSelectedIds.filter(id =>
				filteredSuppliers.some(supplier => supplier.supplierId === id),
			),
		)
	}, [filteredSuppliers])

	if ((!supplierElements || supplierElements.length === 0) && !isLoading) {
		return (
			<EmptyState
				title={t('common.emptyStateTitle')}
				description={t('common.emptyStateDescription')}
			/>
		)
	}

	return (
		<VStack w="100%" p={0} align="stretch">
			<Box px={4} mb={3} maxW={{ base: '100%', md: '21rem' }}>
				<InputGroup size="sm">
					<InputLeftElement pointerEvents="none">
						<Icon as={AsSearchIcon} color="#929494" boxSize={5} />
					</InputLeftElement>
					<Input
						value={searchText}
						onChange={event => setSearchText(event.target.value)}
						placeholder={t('components.filters.nameOrCodeSearchPlaceholder')}
						borderRadius="lg"
						bg="gray.50"
						border="1px solid"
						borderColor="#EAEAEA"
						pl={10}
						autoComplete="off"
						spellCheck={false}
					/>
				</InputGroup>
			</Box>

			{selectedSupplierIds.length > 0 && (
				<SupplierListActionBar
					selectedSuppliers={
						(selectedSupplierIds
							.map(id =>
								filteredSuppliers.find(supplier => supplier.supplierId === id),
							)
							.filter(Boolean) as Supplier[]) ?? []
					}
					isRejectActivityInProgress={false}
					onAddRequiredDocument={() => Promise.resolve()}
					isAddRequiredDocumentInProgress={false}
				/>
			)}

			{filteredSuppliers.length === 0 && !isLoading ? (
				<EmptyState
					title={t('common.emptyStateTitle')}
					description={t('common.emptyStateDescription')}
				/>
			) : isMobile ? (
				<SupplierListMobil
					suppliers={filteredSuppliers}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedSuppliers={selectedSupplierIds}
					areAllItemsSelected={
						filteredSuppliers.length > 0 &&
						selectedSupplierIds.length === filteredSuppliers.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			) : (
				<SupplierListDesktop
					suppliers={filteredSuppliers}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedSuppliers={selectedSupplierIds}
					areAllItemsSelected={
						filteredSuppliers.length > 0 &&
						selectedSupplierIds.length === filteredSuppliers.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			)}
		</VStack>
	)
}

export default SupplierListWithActionBar
