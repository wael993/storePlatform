import { VStack, Heading, Text, SimpleGrid, Box, Checkbox } from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DailyActionType } from '../../../../shared/globalEnums'
import InputLabel from '../../../common/InputLabel'
import { documentNameStyles } from '../../../../theme/styles'
interface ThirdStepProps {
	formData: Partial<DailyAction> | undefined
	handleInputChange: (
		field: 'invoiceNumber' | 'invoiceDate',
		value: string,
	) => void
}
const getTodayDateInputValue = () => {
	const today = new Date()
	const month = String(today.getMonth() + 1).padStart(2, '0')
	const day = String(today.getDate()).padStart(2, '0')

	return `${today.getFullYear()}-${month}-${day}`
}

const getDateInputValue = (date?: string) => date?.split('T')[0] ?? ''

const ThirdStep = ({ formData, handleInputChange }: ThirdStepProps) => {
	const todayDateInputValue = useMemo(() => getTodayDateInputValue(), [])
	const hasInitializedInvoiceDate = useRef(false)
	const [isInvoiceDateToday, setIsInvoiceDateToday] = useState(
		() =>
			!formData?.invoiceDate ||
			getDateInputValue(formData.invoiceDate) === todayDateInputValue,
	)

	useEffect(() => {
		if (hasInitializedInvoiceDate.current || formData?.invoiceDate) return

		hasInitializedInvoiceDate.current = true
		handleInputChange('invoiceDate', todayDateInputValue)
	}, [formData?.invoiceDate, handleInputChange, todayDateInputValue])

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
						<Box border="1px solid #EAEAEA" padding="0.75rem">
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
						</Box>
						<Box border="1px solid #EAEAEA" padding="0.75rem">
							<VStack alignItems="flex-start" spacing={3}>
								<Checkbox
									isChecked={isInvoiceDateToday}
									onChange={event => {
										const isChecked = event.target.checked
										setIsInvoiceDateToday(isChecked)
										handleInputChange(
											'invoiceDate',
											isChecked ? todayDateInputValue : '',
										)
									}}
								>
									Invoice date is today
								</Checkbox>
								{!isInvoiceDateToday && (
									<InputLabel
										label="Invoice Date"
										inputPlaceholder={'invoice date ...'}
										inputType={'date'}
										value={getDateInputValue(formData?.invoiceDate)}
										onChange={(value: string) =>
											handleInputChange('invoiceDate', value)
										}
										styles={documentNameStyles}
									/>
								)}
							</VStack>
						</Box>
					</SimpleGrid>
				)}
			</VStack>
		</>
	)
}

export default ThirdStep
