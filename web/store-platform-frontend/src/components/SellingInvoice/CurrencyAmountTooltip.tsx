import { Box, Text, Tooltip, VStack } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import {
	convertPrimaryAmount,
	convertToPrimaryAmount,
	getCurrencyLabel,
	getOtherCurrencyAmountLines,
	getSavedOtherCurrencyAmountLines,
	type DisplayCurrencyOption,
	type InvoiceCurrencyAmount,
	type SavedCurrencyAmountField,
} from './currencyDisplay'
import EditableNumberField from './EditableNumberField'

interface CurrencyAmountTooltipProps {
	amount: number
	displayText: string
	options: DisplayCurrencyOption[]
	displayCurrencyId: string | null
	savedCurrencyAmounts?: InvoiceCurrencyAmount[]
	savedAmountField?: SavedCurrencyAmountField
	fontSize?: string
	fontWeight?: number | string
	color?: string
	onEdit?: (amount: number) => void | Promise<void>
}

const CurrencyAmountTooltip = ({
	amount,
	displayText,
	options,
	displayCurrencyId,
	savedCurrencyAmounts,
	savedAmountField,
	fontSize = 'sm',
	fontWeight = 600,
	color,
	onEdit,
}: CurrencyAmountTooltipProps) => {
	const { t } = useTranslation()
	const otherCurrencies =
		savedCurrencyAmounts?.length && savedAmountField
			? getSavedOtherCurrencyAmountLines(
					savedCurrencyAmounts,
					savedAmountField,
					displayCurrencyId,
				)
			: getOtherCurrencyAmountLines(amount, options, displayCurrencyId)

	const displayAmount = displayCurrencyId
		? convertPrimaryAmount(amount, displayCurrencyId, options)
		: amount

	const content = onEdit ? (
		<EditableNumberField
			value={displayAmount}
			currency={getCurrencyLabel(displayCurrencyId, options)}
			isEditable
			fontSize={fontSize}
			fontWeight={fontWeight}
			color={color}
			onSave={async editedAmount => {
				await onEdit(
					convertToPrimaryAmount(editedAmount, displayCurrencyId, options),
				)
			}}
		/>
	) : (
		<Text fontSize={fontSize} fontWeight={fontWeight} color={color}>
			{displayText}
		</Text>
	)

	if (otherCurrencies.length === 0) {
		return content
	}

	return (
		<Tooltip
			hasArrow
			placement="top"
			openDelay={200}
			label={
				<VStack align="stretch" spacing={1} py={1}>
					<Text fontSize="xs" fontWeight={700} opacity={0.85}>
						{t('components.sellingInvoices.drawer.otherCurrencies')}
					</Text>
					{otherCurrencies.map(currency => (
						<Text key={currency.currencyId} fontSize="sm" whiteSpace="nowrap">
							{currency.text}
						</Text>
					))}
				</VStack>
			}
		>
			<Box as="span" display="inline-block">
				{content}
			</Box>
		</Tooltip>
	)
}

export default CurrencyAmountTooltip
