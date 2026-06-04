import { Heading, SimpleGrid, VStack, Box } from '@chakra-ui/react'
import { t } from 'i18next'
import React from 'react'
import { documentNameStyles } from '../../../../theme/styles'
import InputLabel from '../../../common/InputLabel'
import TextLabel from '../../../common/TextLabel'
import { Dropdown } from '../../../dropdown/Dropdown'
import { dropdownStyles } from '../../../filters/dropdowns/styles'

interface SecondStepProps {
	isBuyingEntry: boolean
	isSellingEntry: boolean
	isReceiptAction: boolean
	isPaymentEntry: boolean
	formData: Partial<DailyAction> | undefined
	productOptions: any
	supplierOptions: DropdownOption[]
	customerOptions: DropdownOption[]
	currencyOptions: DropdownOption[]
	unitOptions: DropdownOption[]
	totalPrice: string
	handleDropdownChange: (
		valueField: keyof DailyAction,
		labelField: keyof DailyAction,
		values: string[],
		options: DropdownOption[],
	) => void
	handleInputChange: (
		field: 'weight' | 'singleUnitPrice',
		value: string,
	) => void
}

const SecondStep = ({
	isBuyingEntry,
	isSellingEntry,
	isReceiptAction,
	isPaymentEntry,
	formData,
	productOptions,
	supplierOptions,
	customerOptions,
	currencyOptions,
	unitOptions,
	totalPrice,
	handleDropdownChange,
	handleInputChange,
}: SecondStepProps) => {
	const dropdownOptions = !Array.isArray(productOptions)
		? productOptions.products.map((product: Product) => ({
				value: product.productId,
				label: product.name,
			}))
		: []

	return (
		<>
			{(isBuyingEntry || isSellingEntry) && (
				<>
					<Heading fontSize={'1rem'} marginBottom={'1rem'}>
						{isBuyingEntry ? 'Buying Action' : 'Selling Action'}
					</Heading>

					<SimpleGrid columns={[1, 2, 3]} gap={6}>
						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<TextLabel label={' Product'} />
							<Box sx={dropdownStyles.dropDownContainer}>
								<Dropdown
									isSingle={true}
									placeholder={t('Product Name')}
									dropDownOptions={dropdownOptions}
									selectedValues={
										formData?.productId ? [formData.productId] : []
									}
									onSelect={(values: string[]) =>
										handleDropdownChange(
											'productId',
											'productName',
											values,
											dropdownOptions,
										)
									}
								/>
							</Box>
						</VStack>

						{isBuyingEntry && (
							<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
								<TextLabel label={' Supplier'} />
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										isSingle={true}
										placeholder={t('Supplier Name')}
										dropDownOptions={supplierOptions}
										selectedValues={
											formData?.supplierId ? [formData.supplierId] : []
										}
										onSelect={(values: string[]) =>
											handleDropdownChange(
												'supplierId',
												'supplierName',
												values,
												supplierOptions,
											)
										}
									/>
								</Box>
							</VStack>
						)}

						{isSellingEntry && (
							<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
								<TextLabel label={' Customer'} />
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										isSingle={true}
										placeholder={t('Customer Name')}
										dropDownOptions={customerOptions}
										selectedValues={
											formData?.customerId ? [formData.customerId] : []
										}
										onSelect={(values: string[]) =>
											handleDropdownChange(
												'customerId',
												'customerName',
												values,
												customerOptions,
											)
										}
									/>
								</Box>
							</VStack>
						)}

						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<TextLabel label={' Currency'} />
							<Box sx={dropdownStyles.dropDownContainer}>
								<Dropdown
									placeholder={t('Currency Name')}
									dropDownOptions={currencyOptions}
									isSingle
									selectedValues={
										formData?.currencyId ? [formData.currencyId] : []
									}
									onSelect={(values: string[]) =>
										handleDropdownChange(
											'currencyId',
											'currencyName',
											values,
											currencyOptions,
										)
									}
								/>
							</Box>
						</VStack>
						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<TextLabel label={' Unit'} />
							<Box sx={dropdownStyles.dropDownContainer}>
								<Dropdown
									placeholder={t('Unit Name')}
									dropDownOptions={unitOptions}
									selectedValues={formData?.unitId ? [formData.unitId] : []}
									isSingle={true}
									onSelect={(values: string[]) =>
										handleDropdownChange(
											'unitId',
											'unitName',
											values,
											unitOptions,
										)
									}
								/>
							</Box>
						</VStack>
						<VStack sx={{ gap: '1.25rem', alignItems: 'left' }}>
							<InputLabel
								withGap={true}
								label={'Weight'}
								inputPlaceholder={'Weight'}
								inputType={'number'}
								styles={documentNameStyles}
								value={formData?.weight ?? ''}
								onChange={(value: string) => handleInputChange('weight', value)}
							/>
						</VStack>
						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<InputLabel
								withGap={true}
								label={'Single Unit Price'}
								inputPlaceholder={'Single Unit Price'}
								inputType={'number'}
								styles={documentNameStyles}
								value={formData?.singleUnitPrice ?? ''}
								onChange={(value: string) =>
									handleInputChange('singleUnitPrice', value)
								}
							/>
						</VStack>
					</SimpleGrid>

					<Box
						sx={{
							border: '3px solid #376288 ',
							padding: '0.5rem',
							marginTop: '1rem',
						}}
					>
						<TextLabel label={'Total Price'} value={totalPrice} />
					</Box>
				</>
			)}
			{(isReceiptAction || isPaymentEntry) && (
				<>
					<Heading fontSize={'1rem'} marginBottom={'1rem'}>
						{isReceiptAction ? 'Receipt Action' : 'Payment Entry'}
					</Heading>
					<SimpleGrid columns={[1, 2, 3]} gap={6}>
						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<TextLabel label={' Currency'} />
							<Box sx={dropdownStyles.dropDownContainer}>
								<Dropdown
									placeholder={t('Currency Name')}
									dropDownOptions={currencyOptions}
									isSingle
									selectedValues={
										formData?.currencyId ? [formData.currencyId] : []
									}
									onSelect={(values: string[]) =>
										handleDropdownChange(
											'currencyId',
											'currencyName',
											values,
											currencyOptions,
										)
									}
								/>
							</Box>
						</VStack>
						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<InputLabel
								withGap={true}
								label={'Amount'}
								inputPlaceholder={'Amount'}
								inputType={'number'}
								styles={documentNameStyles}
								value={formData?.singleUnitPrice ?? ''}
								onChange={(value: string) =>
									handleInputChange('singleUnitPrice', value)
								}
							/>
						</VStack>
					</SimpleGrid>
				</>
			)}
		</>
	)
}

export default SecondStep
