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
import CustomerListActionBar from './CustomerListActionBar'
import CustomerListDesktop from './CustomerListDesktop'
import EmptyState from '../../common/EmptyState'
import { compareBreakpoint } from '../../../shared/utils'
import { useBreakpoints } from '../../../shared/hooks/useBreakpoints'
import CustomerListMobil from './CustomerListMobil'
import { matchesNameOrCode } from '../../list/shared/utils'
import { AsSearchIcon } from '../../../icons/Search'
import { useSee } from '../../../shared/hooks/useSee'
import { SEE } from '../../../shared/seeFlags'

interface CustomerListWithActionBarProps {
	customers?: Customer[]
	isLoading: boolean
}

const CustomerListWithActionBar = ({
	customers,
	isLoading,
}: CustomerListWithActionBarProps) => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const canDelete = canSee(SEE.customersDelete)
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const [searchText, setSearchText] = useState('')
	const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
	const customerElements: Customer[] = useMemo(() => {
		return (
			customers?.map((customer: Customer) => {
				return {
					...customer,
					isSelectable: true,
				}
			}) || []
		)
	}, [customers])

	const filteredCustomers = useMemo(
		() =>
			customerElements.filter(customer =>
				matchesNameOrCode(customer, searchText),
			),
		[customerElements, searchText],
	)

	const onSelect = useCallback((id: string) => {
		setSelectedCustomerIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])

	const onAllItemsSelectedChange = useCallback(() => {
		setSelectedCustomerIds(prevSelectedIds =>
			prevSelectedIds.length === filteredCustomers.length
				? []
				: filteredCustomers.map(a => a.customerId),
		)
	}, [filteredCustomers])

	useEffect(() => {
		setSelectedCustomerIds(prevSelectedIds =>
			prevSelectedIds.filter(id =>
				filteredCustomers.some(customer => customer.customerId === id),
			),
		)
	}, [filteredCustomers])

	if ((!customerElements || customerElements.length === 0) && !isLoading) {
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

			{canDelete && selectedCustomerIds.length > 0 && (
				<CustomerListActionBar
					selectedCustomers={
						(selectedCustomerIds
							.map(id =>
								filteredCustomers.find(customer => customer.customerId === id),
							)
							.filter(Boolean) as Customer[]) ?? []
					}
				/>
			)}

			{filteredCustomers.length === 0 && !isLoading ? (
				<EmptyState
					title={t('common.emptyStateTitle')}
					description={t('common.emptyStateDescription')}
				/>
			) : isMobile ? (
				<CustomerListMobil
					customers={filteredCustomers}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedCustomers={selectedCustomerIds}
					areAllItemsSelected={
						filteredCustomers.length > 0 &&
						selectedCustomerIds.length === filteredCustomers.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			) : (
				<CustomerListDesktop
					customers={filteredCustomers}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedCustomers={selectedCustomerIds}
					areAllItemsSelected={
						filteredCustomers.length > 0 &&
						selectedCustomerIds.length === filteredCustomers.length
					}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			)}
		</VStack>
	)
}

export default CustomerListWithActionBar
