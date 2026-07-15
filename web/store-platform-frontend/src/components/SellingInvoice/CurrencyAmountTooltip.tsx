import { Box, Text, Tooltip, VStack } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import {
	getOtherCurrencyAmountLines,
	getSavedOtherCurrencyAmountLines,
	type DisplayCurrencyOption,
} from './currencyDisplay'

import type { InvoiceCurrencyAmount, SavedCurrencyAmountField } from './currencyDisplay'

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

	if (otherCurrencies.length === 0) {
		return (
			<Text fontSize={fontSize} fontWeight={fontWeight} color={color}>
				{displayText}
			</Text>
		)
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
				<Text
					as="span"
					fontSize={fontSize}
					fontWeight={fontWeight}
					color={color}
					// borderBottom="1px dashed"
					borderColor="currentColor"
				>
					{displayText}
				</Text>
			</Box>
		</Tooltip>
	)
}

export default CurrencyAmountTooltip
