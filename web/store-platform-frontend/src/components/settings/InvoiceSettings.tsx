import {
	Checkbox,
	FormControl,
	FormLabel,
	Input,
	Text,
	Textarea,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

export interface InvoiceBrandFormValues {
	displayName: string
	address: string
	phone: string
	email: string
	taxNumber: string
	logoUrl: string
	footerNote: string
}

interface InvoiceSettingsProps {
	noMergeInvoiceLines: boolean
	brand: InvoiceBrandFormValues
	displayNameFallback?: string
	onNoMergeInvoiceLinesChange: (checked: boolean) => void
	onBrandChange: (field: keyof InvoiceBrandFormValues, value: string) => void
}

const InvoiceSettings = ({
	noMergeInvoiceLines,
	brand,
	displayNameFallback,
	onNoMergeInvoiceLinesChange,
	onBrandChange,
}: InvoiceSettingsProps) => {
	const { t } = useTranslation()

	return (
		<VStack align="stretch" spacing={6} width="100%">
			<FormControl>
				<FormLabel fontWeight={600} mb={4}>
					{t('components.invoiceSettings.title')}
				</FormLabel>
				<Text fontSize="sm" color="gray.600" mb={4}>
					{t('components.invoiceSettings.description')}
				</Text>
				<Checkbox
					isChecked={noMergeInvoiceLines}
					onChange={event => onNoMergeInvoiceLinesChange(event.target.checked)}
				>
					{t('components.invoiceSettings.noMergeInvoiceLines')}
				</Checkbox>
			</FormControl>

			<FormControl>
				<FormLabel fontWeight={600} mb={2}>
					{t('components.invoiceSettings.pdfHeaderTitle')}
				</FormLabel>
				<Text fontSize="sm" color="gray.600" mb={4}>
					{t('components.invoiceSettings.pdfHeaderDescription')}
				</Text>
				<VStack align="stretch" spacing={3}>
					<FormControl>
						<FormLabel fontSize="sm">
							{t('components.invoiceSettings.displayName')}
						</FormLabel>
						<Input
							value={brand.displayName}
							onChange={event =>
								onBrandChange('displayName', event.target.value)
							}
							placeholder={
								displayNameFallback ||
								t('components.invoiceSettings.displayNamePlaceholder')
							}
						/>
					</FormControl>
					<FormControl>
						<FormLabel fontSize="sm">
							{t('components.invoiceSettings.address')}
						</FormLabel>
						<Textarea
							value={brand.address}
							onChange={event => onBrandChange('address', event.target.value)}
							rows={2}
						/>
					</FormControl>
					<FormControl>
						<FormLabel fontSize="sm">
							{t('components.invoiceSettings.phone')}
						</FormLabel>
						<Input
							value={brand.phone}
							onChange={event => onBrandChange('phone', event.target.value)}
						/>
					</FormControl>
					<FormControl>
						<FormLabel fontSize="sm">
							{t('components.invoiceSettings.email')}
						</FormLabel>
						<Input
							type="email"
							value={brand.email}
							onChange={event => onBrandChange('email', event.target.value)}
						/>
					</FormControl>
					<FormControl>
						<FormLabel fontSize="sm">
							{t('components.invoiceSettings.taxNumber')}
						</FormLabel>
						<Input
							value={brand.taxNumber}
							onChange={event => onBrandChange('taxNumber', event.target.value)}
						/>
					</FormControl>
					<FormControl>
						<FormLabel fontSize="sm">
							{t('components.invoiceSettings.logoUrl')}
						</FormLabel>
						<Input
							value={brand.logoUrl}
							onChange={event => onBrandChange('logoUrl', event.target.value)}
							placeholder="https://"
						/>
						<Text fontSize="xs" color="gray.500" mt={1}>
							{t('components.invoiceSettings.logoUrlHint')}
						</Text>
					</FormControl>
					<FormControl>
						<FormLabel fontSize="sm">
							{t('components.invoiceSettings.footerNote')}
						</FormLabel>
						<Textarea
							value={brand.footerNote}
							onChange={event =>
								onBrandChange('footerNote', event.target.value)
							}
							rows={3}
						/>
					</FormControl>
				</VStack>
			</FormControl>
		</VStack>
	)
}

export default InvoiceSettings
