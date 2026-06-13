import React from 'react'
import { Heading, SimpleGrid, VStack, Box } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { documentNameStyles } from '../../../../theme/styles'
import InputLabel from '../../../common/InputLabel'
import TextLabel from '../../../common/TextLabel'
import { Dropdown } from '../../../dropdown/Dropdown'
import { dropdownStyles } from '../../../filters/dropdowns/styles'
import DailyActionsHelperButtons from './DailyActionsHelperButtons'

interface SecondStepProps {
	isBuyingEntry: boolean
	isSellingEntry: boolean
	isReceiptEntry: boolean
	isPaymentEntry: boolean
	formData: Partial<DailyAction> | undefined
	products: Product[]
	suppliers: Supplier[]
	customers: Customer[]
	currency: Currency[]
	unit: Unit[]
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
	isReceiptEntry,
	isPaymentEntry,
	formData,
	products,
	suppliers,
	customers,
	currency,
	unit,
	totalPrice,
	handleDropdownChange,
	handleInputChange,
}: SecondStepProps) => {
	const { t } = useTranslation()

	return (
		<>
			{(isBuyingEntry || isSellingEntry) && (
				<>
					<Heading fontSize={'1rem'} marginBottom={'1rem'}>
						{isBuyingEntry
							? t('components.daily.buyingAction')
							: t('components.daily.sellingAction')}
					</Heading>

					<SimpleGrid columns={[1, 2, 3]} gap={6}>
						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<TextLabel label={t('common.product')} />
							<Box sx={dropdownStyles.dropDownContainer}>
								<Dropdown
									isSingle={true}
									placeholder={t('common.productName')}
									dropDownOptions={products.map((product: Product) => ({
										value: product.productId ?? product.internalCode,
										label: product.name ?? product.internalCode ?? 'TBD',
									}))}
									selectedValues={
										formData?.productId ? [formData.productId] : []
									}
									onSelect={(values: string[]) =>
										handleDropdownChange(
											'productId',
											'productName',
											values,
											products.map((product: Product) => ({
												value: product.productId ?? product.internalCode,
												label: product.name ?? product.internalCode ?? 'TBD',
											})),
										)
									}
								/>
							</Box>
						</VStack>

						{isBuyingEntry && (
							<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
								<TextLabel label={t('common.supplier')} />
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										isSingle={true}
										placeholder={t('common.supplierName')}
										dropDownOptions={suppliers.map(supplier => ({
											value: supplier.supplierId ?? supplier.internalCode,
											label: supplier.name ?? supplier.internalCode ?? 'TBD',
										}))}
										selectedValues={
											formData?.supplierId ? [formData.supplierId] : []
										}
										onSelect={(values: string[]) =>
											handleDropdownChange(
												'supplierId',
												'supplierName',
												values,
												suppliers.map(supplier => ({
													value: supplier.supplierId ?? supplier.internalCode,
													label:
														supplier.name ?? supplier.internalCode ?? 'TBD',
												})),
											)
										}
									/>
								</Box>
							</VStack>
						)}

						{isSellingEntry && (
							<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
								<TextLabel label={t('common.customer')} />
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										isSingle={true}
										placeholder={t('common.customerName')}
										dropDownOptions={customers.map(customer => ({
											value: customer.customerId ?? customer.internalCode,
											label: customer.name ?? customer.internalCode ?? 'TBD',
										}))}
										selectedValues={
											formData?.customerId ? [formData.customerId] : []
										}
										onSelect={(values: string[]) =>
											handleDropdownChange(
												'customerId',
												'customerName',
												values,
												customers.map(customer => ({
													value: customer.customerId ?? customer.internalCode,
													label:
														customer.name ?? customer.internalCode ?? 'TBD',
												})),
											)
										}
									/>
								</Box>
							</VStack>
						)}

						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<TextLabel label={t('common.currency')} />
							<Box sx={dropdownStyles.dropDownContainer}>
								<Dropdown
									placeholder={t('common.currencyName')}
									dropDownOptions={currency.map((currency: Currency) => ({
										value: currency.currencyId ?? currency.internalCode,
										label: currency.name ?? currency.internalCode ?? 'TBD',
									}))}
									isSingle
									selectedValues={
										formData?.currencyId ? [formData.currencyId] : []
									}
									onSelect={(values: string[]) =>
										handleDropdownChange(
											'currencyId',
											'currencyName',
											values,
											currency.map((currency: Currency) => ({
												value: currency.currencyId ?? currency.internalCode,
												label: currency.name ?? currency.internalCode ?? 'TBD',
											})),
										)
									}
								/>
							</Box>
						</VStack>
						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<TextLabel label={t('common.unit')} />
							<Box sx={dropdownStyles.dropDownContainer}>
								<Dropdown
									placeholder={t('common.unitName')}
									dropDownOptions={unit.map((unit: Unit) => ({
										value: unit.unitId ?? unit.internalCode,
										label: unit.name ?? unit.internalCode ?? 'TBD',
									}))}
									selectedValues={formData?.unitId ? [formData.unitId] : []}
									isSingle={true}
									onSelect={(values: string[]) =>
										handleDropdownChange(
											'unitId',
											'unitName',
											values,
											unit.map((unit: Unit) => ({
												value: unit.unitId ?? unit.internalCode,
												label: unit.name ?? unit.internalCode ?? 'TBD',
											})),
										)
									}
								/>
							</Box>
						</VStack>
						<VStack sx={{ gap: '1.25rem', alignItems: 'left' }}>
							<InputLabel
								withGap={true}
								label={t('common.weight')}
								inputPlaceholder={t('common.weight')}
								inputType={'number'}
								styles={documentNameStyles}
								value={formData?.weight ?? ''}
								onChange={(value: string) => handleInputChange('weight', value)}
							/>
						</VStack>
						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<InputLabel
								withGap={true}
								label={t('common.singleUnitPrice')}
								inputPlaceholder={t('common.singleUnitPrice')}
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
						<TextLabel label={t('common.totalPrice')} value={totalPrice} />
					</Box>
					<DailyActionsHelperButtons />
				</>
			)}
			{(isReceiptEntry || isPaymentEntry) && (
				<>
					<Heading fontSize={'1rem'} marginBottom={'1rem'}>
						{isReceiptEntry
							? t('components.daily.receiptAction')
							: t('components.daily.paymentAction')}
					</Heading>
					<SimpleGrid columns={[1, 2, 3]} gap={6}>
						{isPaymentEntry && (
							<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
								<TextLabel label={t('common.supplier')} />
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										isSingle={true}
										placeholder={t('common.supplierName')}
										dropDownOptions={suppliers.map(supplier => ({
											value: supplier.supplierId ?? supplier.internalCode,
											label: supplier.name ?? supplier.internalCode ?? 'TBD',
										}))}
										selectedValues={
											formData?.supplierId ? [formData.supplierId] : []
										}
										onSelect={(values: string[]) =>
											handleDropdownChange(
												'supplierId',
												'supplierName',
												values,
												suppliers.map(supplier => ({
													value: supplier.supplierId ?? supplier.internalCode,
													label:
														supplier.name ?? supplier.internalCode ?? 'TBD',
												})),
											)
										}
									/>
								</Box>
							</VStack>
						)}

						{isReceiptEntry && (
							<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
								<TextLabel label={t('common.customer')} />
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										isSingle={true}
										placeholder={t('common.customerName')}
										dropDownOptions={customers.map(customer => ({
											value: customer.customerId ?? customer.internalCode,
											label: customer.name ?? customer.internalCode ?? 'TBD',
										}))}
										selectedValues={
											formData?.customerId ? [formData.customerId] : []
										}
										onSelect={(values: string[]) =>
											handleDropdownChange(
												'customerId',
												'customerName',
												values,
												customers.map(customer => ({
													value: customer.customerId ?? customer.internalCode,
													label:
														customer.name ?? customer.internalCode ?? 'TBD',
												})),
											)
										}
									/>
								</Box>
							</VStack>
						)}

						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<TextLabel label={t('common.currency')} />
							<Box sx={dropdownStyles.dropDownContainer}>
								<Dropdown
									placeholder={t('common.currencyName')}
									dropDownOptions={currency.map((currency: Currency) => ({
										value: currency.currencyId ?? currency.internalCode,
										label: currency.name ?? currency.internalCode ?? 'TBD',
									}))}
									isSingle
									selectedValues={
										formData?.currencyId ? [formData.currencyId] : []
									}
									onSelect={(values: string[]) =>
										handleDropdownChange(
											'currencyId',
											'currencyName',
											values,
											currency.map((currency: Currency) => ({
												value: currency.currencyId ?? currency.internalCode,
												label: currency.name ?? currency.internalCode ?? 'TBD',
											})),
										)
									}
								/>
							</Box>
						</VStack>
						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<InputLabel
								withGap={true}
								label={t('common.amount')}
								inputPlaceholder={t('common.amount')}
								inputType={'number'}
								styles={documentNameStyles}
								value={formData?.singleUnitPrice ?? ''}
								onChange={(value: string) =>
									handleInputChange('singleUnitPrice', value)
								}
							/>
						</VStack>
					</SimpleGrid>

					<DailyActionsHelperButtons />
				</>
			)}
		</>
	)
}

export default SecondStep
