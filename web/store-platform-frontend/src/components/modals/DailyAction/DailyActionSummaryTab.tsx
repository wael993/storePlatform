import { Box, Heading, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { ActionTypes } from '../../../shared/globalEnums'
import { type DailyActionSummary } from './DailyActionDataTab'

interface DailyActionSummaryTabProps {
	actionType: ActionTypes | ''
	actionSummary: DailyActionSummary
}

const getActionSummaryRows = (
	actionType: ActionTypes | '',
	actionSummary: DailyActionSummary,
) => {
	switch (actionType) {
		case ActionTypes.buying:
			return [
				{ label: 'Product', value: actionSummary.product },
				{ label: 'Supplier', value: actionSummary.supplier },
				{ label: 'Currency', value: actionSummary.currency },
				{ label: 'Unit', value: actionSummary.unit },
				{ label: 'Weight', value: actionSummary.weight },
				{
					label: 'Single Unit Price',
					value: actionSummary.singleUnitPrice,
				},
				{ label: 'Total Price', value: actionSummary.totalPrice },
			]
		case ActionTypes.selling:
			return [
				{ label: 'Product', value: actionSummary.product },
				{ label: 'Customer', value: actionSummary.customer },
				{ label: 'Currency', value: actionSummary.currency },
				{ label: 'Unit', value: actionSummary.unit },
				{ label: 'Weight', value: actionSummary.weight },
				{
					label: 'Single Unit Price',
					value: actionSummary.singleUnitPrice,
				},
			]
		case ActionTypes.receipt:
			return [
				{ label: 'Sales Area', value: actionSummary.salesArea },
				{
					label: 'Location/Customer',
					value: actionSummary.locationCustomer,
				},
			]
		default:
			return []
	}
}

const DailyActionSummaryTab = ({
	actionType,
	actionSummary,
}: DailyActionSummaryTabProps) => {
	const actionSummaryRows = getActionSummaryRows(actionType, actionSummary)

	return (
		<VStack alignItems="flex-start" spacing={4}>
			<Heading fontSize="1rem">Action Summary</Heading>
			{actionSummaryRows.length === 0 ? (
				<Text color="#747474">No summary available for this action.</Text>
			) : (
				<SimpleGrid columns={[1, 2]} spacing={4} width="100%">
					{actionSummaryRows.map(row => (
						<Box key={row.label} border="1px solid #EAEAEA" padding="0.75rem">
							<Text fontSize="0.75rem" color="#747474">
								{row.label}
							</Text>
							<Text fontWeight={700} color="#1E1E1E">
								{row.value || '-'}
							</Text>
						</Box>
					))}
				</SimpleGrid>
			)}
		</VStack>
	)
}

export default DailyActionSummaryTab
