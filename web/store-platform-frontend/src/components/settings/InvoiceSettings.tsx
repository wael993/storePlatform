import {
	Checkbox,
	FormControl,
	FormLabel,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

interface InvoiceSettingsProps {
	noMergeInvoiceLines: boolean
	onNoMergeInvoiceLinesChange: (checked: boolean) => void
}

const InvoiceSettings = ({
	noMergeInvoiceLines,
	onNoMergeInvoiceLinesChange,
}: InvoiceSettingsProps) => {
	const { t } = useTranslation()

	return (
		<VStack align="stretch" spacing={4} width="100%">
			<FormControl>
				<FormLabel fontWeight={600} mb={4}>
					{t('components.invoiceSettings.title')}
				</FormLabel>
				<Text fontSize="sm" color="gray.600" mb={4}>
					{t('components.invoiceSettings.description')}
				</Text>
				<Checkbox
					isChecked={noMergeInvoiceLines}
					onChange={event =>
						onNoMergeInvoiceLinesChange(event.target.checked)
					}
				>
					{t('components.invoiceSettings.noMergeInvoiceLines')}
				</Checkbox>
			</FormControl>
		</VStack>
	)
}

export default InvoiceSettings
