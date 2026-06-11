import { Box, Center, Text, VStack } from '@chakra-ui/react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useCustomToast from '../../common/CustomToast'
import { compareBreakpoint } from '../../../shared/utils'
import { useBreakpoints } from '../../../shared/hooks/useBreakpoints'
import CustomerListActionBar from './CustomerListActionBar'
import CustomerListDesktop from './CustomerListDesktop'

const styles: StylesObject = {
	noActivities: {
		color: '#6F6F6F',
		fontWeight: '700',
		marginTop: '3rem',
	},
}

interface CustomerListWithActionBarProps {
	customers?: Customer[]
	isLoading: boolean
}

const CustomerListWithActionBar = ({
	customers,
	isLoading,
}: CustomerListWithActionBarProps) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const { isMobile } = compareBreakpoint(useBreakpoints())
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

	const onSelect = useCallback((id: string) => {
		setSelectedCustomerIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])

	const onAllItemsSelectedChange = useCallback(() => {
		setSelectedCustomerIds(prevSelectedIds =>
			prevSelectedIds.length === customerElements.length
				? []
				: customerElements.map(a => a.customerId),
		)
	}, [customerElements])

	if ((!customerElements || customerElements.length === 0) && !isLoading) {
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
			{selectedCustomerIds.length > 0 && (
				<CustomerListActionBar
					selectedCustomers={
						(selectedCustomerIds
							.map(id =>
								customerElements?.find(customer => customer.customerId === id),
							)
							.filter(Boolean) as Customer[]) ?? []
					}
					isRejectActivityInProgress={false}
					onAddRequiredDocument={() => Promise.resolve()}
					isAddRequiredDocumentInProgress={false}
				/>
			)}
			<CustomerListDesktop
				customers={customerElements}
				isLoading={isLoading}
				onSelect={onSelect}
				selectedCustomers={selectedCustomerIds}
				areAllItemsSelected={
					selectedCustomerIds.length === customerElements.length
				}
				onAllItemsSelectedChange={onAllItemsSelectedChange}
			/>
		</VStack>
	)
}

export default CustomerListWithActionBar
