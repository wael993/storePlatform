import { VStack, Heading, Text, SimpleGrid, Box } from '@chakra-ui/react'
import React from 'react'
import { DailyActionType } from '../../../../shared/globalEnums'
import InputLabel from '../../../common/InputLabel'
import { documentNameStyles } from '../../../../theme/styles'
interface ThirdStepProps {
	formData: Partial<DailyAction> | undefined
	handleInputChange: (field: 'invoiceNumber', value: string) => void
}
const ThirdStep = ({ formData, handleInputChange }: ThirdStepProps) => {
	const getActionSummaryRows = (
		actionSummary: Partial<DailyAction> | undefined,
	) => {
		switch (actionSummary?.entryType) {
			case DailyActionType.BUYING_ENTRY:
				return [
					{ label: 'Product', value: actionSummary?.productName },
					{ label: 'Supplier', value: actionSummary?.supplierName },
					{ label: 'Currency', value: actionSummary?.currencyName },
					{ label: 'Unit', value: actionSummary?.unitName },
					{ label: 'Weight', value: actionSummary?.weight },
					{
						label: 'Single Unit Price',
						value: actionSummary?.singleUnitPrice,
					},
					{ label: 'Total Price', value: actionSummary?.totalPrice },
				]
			case DailyActionType.SELLING_ENTRY:
				return [
					{ label: 'Product', value: actionSummary?.productName },
					{ label: 'Customer', value: actionSummary?.customerName },
					{ label: 'Currency', value: actionSummary?.currencyName },
					{ label: 'Unit', value: actionSummary?.unitName },
					{ label: 'Weight', value: actionSummary?.weight },
					{
						label: 'Single Unit Price',
						value: actionSummary?.singleUnitPrice,
					},
				]
			case DailyActionType.RECEIPT_ACTION:
				return [
					{ label: 'Currency', value: actionSummary?.currencyName },
					{
						label: 'Location/Customer',
						value: actionSummary?.customerName,
					},
				]
			default:
				return []
		}
	}
	const actionSummaryRows = getActionSummaryRows(formData)

	return (
		<>
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
						<InputLabel
							label="Invoice Number"
							inputPlaceholder={'invoice number ...'}
							inputType={'text'}
							value={formData?.invoiceNumber ?? ''}
							onChange={(value: string) =>
								handleInputChange('invoiceNumber', value)
							}
							styles={documentNameStyles}
						/>
					</SimpleGrid>
				)}
			</VStack>
		</>
	)
}

export default ThirdStep
