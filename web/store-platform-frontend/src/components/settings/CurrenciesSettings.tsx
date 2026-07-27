import {
	Box,
	Button,
	Flex,
	FormControl,
	FormLabel,
	Grid,
	Heading,
	IconButton,
	Input,
	InputGroup,
	InputRightAddon,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { AsCloseIcon } from '../icons/Close'
import type { CurrencySettingItem } from '../../api/apiStore'
import DropdownLabel from '../DropdownLabel'
import { buildOptionsFromItems } from '../SellingInvoice/currencyDisplay'

interface CurrenciesSettingsProps {
	primaryCurrency: CurrencySettingItem | null
	secondaryCurrencies: CurrencySettingItem[]
	defaultInvoiceCurrencyId: string
	onDefaultInvoiceCurrencyChange: (currencyId: string) => void
	onPrimaryChange: (field: 'name' | 'internalCode', value: string) => void
	onSecondaryChange: (
		index: number,
		field: 'name' | 'internalCode' | 'exchangeRate',
		value: string,
	) => void
	onAddSecondary: () => void
	onRemoveSecondary: (index: number) => void
}

const styles = {
	sectionHeading: {
		fontSize: '0.875rem',
		fontWeight: 700,
		color: '#376288',
		mb: 4,
	},
	sectionBox: {
		border: '1px solid #EAEAEA',
		p: 4,
		bg: '#FAFAFA',
	},
	label: {
		fontWeight: 600,
		fontSize: '0.875rem',
		color: '#333333',
	},
	hint: {
		fontSize: '0.75rem',
		color: '#939596',
		mt: 1,
	},
	secondaryRow: {
		border: '1px solid #EAEAEA',
		p: 3,
		bg: '#FFFFFF',
		gap: 3,
		alignItems: 'flex-end',
	},
	addButton: {
		borderRadius: 0,
		fontSize: '0.875rem',
		fontWeight: 600,
		color: '#376288',
		borderColor: '#376288',
		mt: 2,
	},
} satisfies StylesObject

const CurrenciesSettings = ({
	primaryCurrency,
	secondaryCurrencies,
	defaultInvoiceCurrencyId,
	onDefaultInvoiceCurrencyChange,
	onPrimaryChange,
	onSecondaryChange,
	onAddSecondary,
	onRemoveSecondary,
}: CurrenciesSettingsProps) => {
	const { t } = useTranslation()
	const primaryName =
		primaryCurrency?.name?.trim() ||
		t('components.currenciesSettings.primaryLabel')
	const displayCurrencyOptions = buildOptionsFromItems(
		primaryCurrency,
		secondaryCurrencies,
	)

	return (
		<VStack align="stretch" spacing={6} width="100%">
			<Grid
				templateColumns={{ base: '1fr', lg: '1fr 1fr' }}
				gap={8}
				width="100%"
			>
				<Box>
					<Heading sx={styles.sectionHeading}>
						{t('components.currenciesSettings.secondaryTitle')}
					</Heading>
					<Text sx={styles.hint} mb={4}>
						{t('components.currenciesSettings.secondaryDescription')}
					</Text>

					<VStack align="stretch" spacing={3}>
						{secondaryCurrencies.map((secondary, index) => (
							<Flex
								key={secondary.currencyId || index}
								sx={styles.secondaryRow}
							>
								<FormControl flex={1}>
									<FormLabel sx={styles.label}>
										{t('components.currenciesSettings.currencyName')}
									</FormLabel>
									<Input
										value={secondary.name}
										onChange={event =>
											onSecondaryChange(index, 'name', event.target.value)
										}
										placeholder={t(
											'components.currenciesSettings.namePlaceholder',
										)}
										borderRadius={0}
									/>
								</FormControl>

								<FormControl flex={1}>
									<FormLabel sx={styles.label}>
										{t('components.currenciesSettings.currencyCode')}
									</FormLabel>
									<Input
										value={secondary.internalCode ?? ''}
										onChange={event =>
											onSecondaryChange(
												index,
												'internalCode',
												event.target.value,
											)
										}
										placeholder={t(
											'components.currenciesSettings.codePlaceholder',
										)}
										borderRadius={0}
									/>
								</FormControl>

								<FormControl flex={1}>
									<FormLabel sx={styles.label}>
										{t('components.currenciesSettings.exchangeRate')}
									</FormLabel>
									<InputGroup>
										<Input
											type="number"
											min={0}
											step="any"
											value={secondary.exchangeRate ?? ''}
											onChange={event =>
												onSecondaryChange(
													index,
													'exchangeRate',
													event.target.value,
												)
											}
											placeholder="0"
											borderRadius={0}
										/>
										<InputRightAddon
											borderRadius={0}
											fontSize="0.75rem"
											whiteSpace="nowrap"
										>
											{t('components.currenciesSettings.rateSuffix', {
												primary: primaryName,
												secondary:
													secondary.name?.trim() ||
													t('components.currenciesSettings.secondaryLabel'),
											})}
										</InputRightAddon>
									</InputGroup>
								</FormControl>

								<IconButton
									aria-label={t(
										'components.currenciesSettings.removeSecondary',
									)}
									icon={<AsCloseIcon />}
									variant="ghost"
									color="#939596"
									onClick={() => onRemoveSecondary(index)}
									mb={1}
								/>
							</Flex>
						))}
					</VStack>

					<Button
						variant="outline"
						sx={styles.addButton}
						onClick={onAddSecondary}
					>
						{t('components.currenciesSettings.addSecondary')}
					</Button>
				</Box>

				<Box sx={styles.sectionBox}>
					<Heading sx={styles.sectionHeading}>
						{t('components.currenciesSettings.primaryTitle')}
					</Heading>
					<Text sx={styles.hint} mb={4}>
						{t('components.currenciesSettings.primaryDescription')}
					</Text>

					<VStack align="stretch" spacing={4}>
						<FormControl>
							<FormLabel sx={styles.label}>
								{t('components.currenciesSettings.currencyName')}
							</FormLabel>
							<Input
								value={primaryCurrency?.name ?? ''}
								onChange={event => onPrimaryChange('name', event.target.value)}
								placeholder={t(
									'components.currenciesSettings.primaryNamePlaceholder',
								)}
								borderRadius={0}
							/>
						</FormControl>

						<FormControl>
							<FormLabel sx={styles.label}>
								{t('components.currenciesSettings.currencyCode')}
							</FormLabel>
							<Input
								value={primaryCurrency?.internalCode ?? ''}
								onChange={event =>
									onPrimaryChange('internalCode', event.target.value)
								}
								placeholder={t('components.currenciesSettings.codePlaceholder')}
								borderRadius={0}
							/>
						</FormControl>
					</VStack>
				</Box>
			</Grid>

			{displayCurrencyOptions.length > 0 && (
				<Box maxW={{ base: '100%', lg: '50%' }}>
					<DropdownLabel
						label={t('components.currenciesSettings.defaultInvoiceCurrency')}
						options={displayCurrencyOptions.map(option => ({
							label: `${option.name} (${option.label})`,
							value: option.currencyId,
						}))}
						selectedOptions={
							defaultInvoiceCurrencyId || primaryCurrency?.currencyId
								? displayCurrencyOptions
										.filter(
											option =>
												option.currencyId ===
												(defaultInvoiceCurrencyId ||
													primaryCurrency?.currencyId),
										)
										.map(option => ({
											label: `${option.name} (${option.label})`,
											value: option.currencyId,
										}))
								: []
						}
						onSelect={values => onDefaultInvoiceCurrencyChange(values[0] ?? '')}
						placeholder={t(
							'components.currenciesSettings.defaultInvoiceCurrencyPlaceholder',
						)}
						isSingle
						isSearchable={false}
						customStyles={{
							dropdownContainer: { width: '100%' },
							dropdownMenu: {
								mt: '0.4rem',
								borderRadius: 'none',
								width: '100%',
							},
							dropdownPlaceholder: { width: '100%' },
						}}
					/>
					<Text sx={styles.hint} mt={2}>
						{t('components.currenciesSettings.defaultInvoiceCurrencyHint')}
					</Text>
				</Box>
			)}
		</VStack>
	)
}

export default CurrenciesSettings
