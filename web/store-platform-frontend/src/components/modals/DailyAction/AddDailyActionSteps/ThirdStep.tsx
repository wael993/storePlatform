import {
	VStack,
	Heading,
	Text,
	SimpleGrid,
	Box,
	Checkbox,
} from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DailyActionType } from '../../../../shared/globalEnums'
import InputLabel from '../../../common/InputLabel'
import { documentNameStyles } from '../../../../theme/styles'
import DatePickerLabel from '../../../common/DatePickerLabel'
import { useTranslation } from 'react-i18next'

interface ThirdStepProps {
	formData: Partial<DailyAction> | undefined
	handleInputChange: (
		field: 'invoiceNumber' | 'invoiceDate',
		value: string,
	) => void
}

const getDateInputValueFromDate = (date: Date) => {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')

	return `${date.getFullYear()}-${month}-${day}`
}

const getTodayDateInputValue = () => getDateInputValueFromDate(new Date())

const getDateInputValue = (date?: string) => date?.split('T')[0] ?? ''

const getDateFromInputValue = (date?: string) => {
	const dateInputValue = getDateInputValue(date)

	if (!dateInputValue) return undefined

	const [year, month, day] = dateInputValue.split('-').map(Number)

	return new Date(year, month - 1, day)
}

const ThirdStep = ({ formData, handleInputChange }: ThirdStepProps) => {
	const { t } = useTranslation()

	const todayDateInputValue = useMemo(() => getTodayDateInputValue(), [])
	const selectedInvoiceDate = useMemo(
		() => getDateFromInputValue(formData?.invoiceDate),
		[formData?.invoiceDate],
	)
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
								label={t('common.invoiceNumber')}
								inputPlaceholder={t('common.invoiceNumberPlaceholder')}
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
									{t('common.invoiceDateIsToday')}
								</Checkbox>
								{!isInvoiceDateToday && (
									<VStack alignItems="flex-start" width="100%">
										<DatePickerLabel
											label={t('common.invoiceDate')}
											onChange={(date: Date | undefined) =>
												handleInputChange(
													'invoiceDate',
													date ? getDateInputValueFromDate(date) : '',
												)
											}
											defaultDate={selectedInvoiceDate}
											allowClear
											placeholder={t('common.invoiceDatePlaceholder')}
										/>
									</VStack>
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
