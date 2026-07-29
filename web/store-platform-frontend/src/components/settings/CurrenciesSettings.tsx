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
	Text,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { AsCloseIcon } from '../icons/Close'
import type { CurrencySettingItem } from '../../api/apiStore'
import DropdownLabel from '../DropdownLabel'
import {
	buildOptionsFromItems,
	getExchangeRateDisplayValue,
	normalizeExchangeRateInput,
} from '../SellingInvoice/currencyDisplay'

interface CurrenciesSettingsProps {
	primaryCurrency: CurrencySettingItem | null
	secondaryCurrencies: CurrencySettingItem[]
	defaultInvoiceCurrencyId: string
	onDefaultInvoiceCurrencyChange: (currencyId: string) => void
	onPrimaryChange: (field: 'name' | 'internalCode', value: string) => void
	onSecondaryChange: (
		index: number,
		field:
			| 'name'
			| 'internalCode'
			| 'exchangeRate'
			| 'exchangeRateUnitCurrencyId',
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
		flexWrap: 'wrap',
	},
	addButton: {
		borderRadius: 0,
		fontSize: '0.875rem',
		fontWeight: 600,
		color: '#376288',
		borderColor: '#376288',
		mt: 2,
	},
	rateRow: {
		alignItems: 'flex-end',
		gap: 2,
		flexWrap: 'wrap',
		width: '100%',
	},
	rateOne: {
		fontSize: '0.875rem',
		fontWeight: 600,
		color: '#333333',
		pb: 2,
		flexShrink: 0,
	},
	rateEquals: {
		fontSize: '0.875rem',
		fontWeight: 600,
		color: '#333333',
		pb: 2,
		flexShrink: 0,
	},
	rateInput: {
		width: { base: '100%', md: '7rem' },
		flexShrink: 0,
	},
	rateDropdown: {
		width: { base: '100%', md: '8rem' },
		flexShrink: 0,
	},
} satisfies StylesObject

const dropdownStyles = {
	labelText: { display: 'none' },
	dropdownContainer: { width: '100%' },
	dropdownMenu: { mt: '0.25rem', borderRadius: 'none', width: '100%' },
	dropdownPlaceholder: { width: '100%' },
}

const toDropdownOptions = (
	items: Array<{ currencyId: string; label: string }>,
) =>
	items.map(item => ({
		label: item.label,
		value: item.currencyId,
	}))

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
	const displayCurrencyOptions = buildOptionsFromItems(
		primaryCurrency,
		secondaryCurrencies,
	)

	const getRowCurrencyOptions = (secondary: CurrencySettingItem) => {
		if (!primaryCurrency?.currencyId) {
			return []
		}

		const primaryLabel =
			primaryCurrency.internalCode?.trim() ||
			primaryCurrency.name?.trim() ||
			t('components.currenciesSettings.primaryLabel')
		const secondaryLabel =
			secondary.internalCode?.trim() ||
			secondary.name?.trim() ||
			t('components.currenciesSettings.secondaryLabel')

		return [
			{
				currencyId: primaryCurrency.currencyId,
				label: primaryLabel,
			},
			{
				currencyId: secondary.currencyId,
				label: secondaryLabel,
			},
		]
	}

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
						{secondaryCurrencies.map((secondary, index) => {
							const rowCurrencyOptions = getRowCurrencyOptions(secondary)
							const primaryCurrencyId = primaryCurrency?.currencyId ?? ''
							const unitCurrencyId =
								secondary.exchangeRateUnitCurrencyId || primaryCurrencyId
							const quoteCurrencyId =
								unitCurrencyId === primaryCurrencyId
									? secondary.currencyId
									: primaryCurrencyId
							const displayRate = getExchangeRateDisplayValue(
								secondary.exchangeRate,
								unitCurrencyId,
								primaryCurrencyId,
							)
							const rowDropdownOptions = toDropdownOptions(rowCurrencyOptions)

							return (
								<Flex
									key={secondary.currencyId || index}
									sx={styles.secondaryRow}
								>
									<FormControl flex={{ base: '1 1 100%', md: '1 1 10rem' }}>
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

									<FormControl flex={{ base: '1 1 100%', md: '1 1 8rem' }}>
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

									<FormControl flex={{ base: '1 1 100%', md: '1 1 auto' }}>
										<FormLabel sx={styles.label}>
											{t('components.currenciesSettings.exchangeRate')}
										</FormLabel>
										<Flex sx={styles.rateRow}>
											<Text sx={styles.rateOne}>1</Text>
											<Box sx={styles.rateDropdown}>
												<DropdownLabel
													label={t(
														'components.currenciesSettings.unitCurrency',
													)}
													options={rowDropdownOptions}
													selectedOptions={rowDropdownOptions.filter(
														option => option.value === unitCurrencyId,
													)}
													onSelect={values => {
														const nextUnitId = values[0]
														if (!nextUnitId) {
															return
														}

														onSecondaryChange(
															index,
															'exchangeRateUnitCurrencyId',
															nextUnitId,
														)
													}}
													placeholder={t(
														'components.currenciesSettings.unitCurrencyPlaceholder',
													)}
													isSingle
													isSearchable={false}
													customStyles={dropdownStyles}
												/>
											</Box>
											<Text sx={styles.rateEquals}>=</Text>
											<Input
												type="number"
												min={0}
												step="any"
												value={displayRate ?? ''}
												onChange={event => {
													const rawValue = event.target.value
													if (rawValue === '') {
														onSecondaryChange(index, 'exchangeRate', '')
														return
													}

													const parsed = Number(rawValue)
													if (Number.isNaN(parsed)) {
														return
													}

													const canonicalRate = normalizeExchangeRateInput(
														parsed,
														unitCurrencyId,
														primaryCurrencyId,
													)
													onSecondaryChange(
														index,
														'exchangeRate',
														String(canonicalRate),
													)
												}}
												placeholder="0"
												borderRadius={0}
												sx={styles.rateInput}
											/>
											<Box sx={styles.rateDropdown}>
												<DropdownLabel
													label={t(
														'components.currenciesSettings.quoteCurrency',
													)}
													options={rowDropdownOptions}
													selectedOptions={rowDropdownOptions.filter(
														option => option.value === quoteCurrencyId,
													)}
													onSelect={values => {
														const nextQuoteId = values[0]
														if (
															!nextQuoteId ||
															nextQuoteId === quoteCurrencyId
														) {
															return
														}

														onSecondaryChange(
															index,
															'exchangeRateUnitCurrencyId',
															nextQuoteId === primaryCurrencyId
																? secondary.currencyId
																: primaryCurrencyId,
														)
													}}
													placeholder={t(
														'components.currenciesSettings.quoteCurrencyPlaceholder',
													)}
													isSingle
													isSearchable={false}
													customStyles={dropdownStyles}
												/>
											</Box>
										</Flex>
										<Text sx={styles.hint}>
											{t('components.currenciesSettings.rateEqualsHint')}
										</Text>
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
							)
						})}
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
