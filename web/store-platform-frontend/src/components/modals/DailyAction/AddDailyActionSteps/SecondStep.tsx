import React, { useEffect, useMemo, useRef } from 'react'
import {
	Button,
	Heading,
	SimpleGrid,
	VStack,
	Box,
	Text,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { documentNameStyles } from '../../../../theme/styles'
import InputLabel from '../../../common/InputLabel'
import TextLabel from '../../../common/TextLabel'
import { Dropdown } from '../../../dropdown/Dropdown'
import { dropdownStyles } from '../../../filters/dropdowns/styles'
import DailyActionsHelperButtons from './DailyActionsHelperButtons'
import { mapFee, parseNumberValue } from '../../../../shared/utils'
import type { DailyActionProductLine } from '../hooks/useDailyActionHandlers'

interface SecondStepProps {
	isBuyingEntry: boolean
	isSellingEntry: boolean
	isReceiptEntry: boolean
	isPaymentEntry: boolean
	isExpenseEntry: boolean
	formData: Partial<DailyAction> | undefined
	productLines: DailyActionProductLine[]
	expenses: Expense[]
	partners: Partner[]
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
	handlePartnerOrEntityDropdownChange: (
		values: string[],
		partnerOptions: DropdownOption[],
		entityOptions: DropdownOption[],
		entityIdField: 'supplierId' | 'customerId' | 'expenseId',
		entityNameField: 'supplierName' | 'customerName' | 'expenseName',
	) => void
	handleInputChange: (field: 'singleUnitPrice' | 'note', value: string) => void
	handleProductLineDropdownChange: (
		lineId: string,
		valueField: keyof DailyActionProductLine,
		labelField: keyof DailyActionProductLine,
		values: string[],
		options: DropdownOption[],
	) => void
	handleProductLineInputChange: (
		lineId: string,
		field: 'weight' | 'singleUnitPrice' | 'note',
		value: string,
	) => void
	addProductLine: () => void
	removeProductLine: (lineId: string) => void
	entryTargetId?: string
}

const SecondStep = ({
	entryTargetId,
	isBuyingEntry,
	isSellingEntry,
	isReceiptEntry,
	isPaymentEntry,
	isExpenseEntry,
	expenses,
	partners,
	formData,
	productLines,
	products,
	suppliers,
	customers,
	currency,
	unit,
	totalPrice,
	handleDropdownChange,
	handlePartnerOrEntityDropdownChange,
	handleInputChange,
	handleProductLineDropdownChange,
	handleProductLineInputChange,
	addProductLine,
	removeProductLine,
}: SecondStepProps) => {
	const { t } = useTranslation()
	const hasInitializedCurrency = useRef(false)
	const hasInitializedUnit = useRef(false)
	const hasInitializedCustomer = useRef(false)
	const hasInitializedSupplier = useRef(false)

	const customerOptions = useMemo<DropdownOption[]>(
		() =>
			customers
				.map(customer => ({
					value: customer.customerId ?? customer.internalCode,
					label: customer.name ?? customer.internalCode ?? 'TBD',
				}))
				.filter((option): option is DropdownOption => Boolean(option.value)),
		[customers],
	)

	const supplierOptions = useMemo<DropdownOption[]>(
		() =>
			suppliers
				.map(supplier => ({
					value: supplier.supplierId ?? supplier.internalCode,
					label: supplier.name ?? supplier.internalCode ?? 'TBD',
				}))
				.filter((option): option is DropdownOption => Boolean(option.value)),
		[suppliers],
	)

	const currencyOptions = useMemo<DropdownOption[]>(
		() =>
			currency
				.map((currency: Currency) => ({
					value: currency.currencyId ?? currency.internalCode,
					label: currency.name ?? currency.internalCode ?? 'TBD',
				}))
				.filter((option): option is DropdownOption => Boolean(option.value)),
		[currency],
	)

	const unitOptions = useMemo<DropdownOption[]>(
		() =>
			unit
				.map((unit: Unit) => ({
					value: unit.unitId ?? unit.internalCode,
					label: unit.name ?? unit.internalCode ?? 'TBD',
				}))
				.filter((option): option is DropdownOption => Boolean(option.value)),
		[unit],
	)

	const productOptions = useMemo<DropdownOption[]>(
		() =>
			products
				.map((product: Product) => ({
					value: product.productId ?? product.internalCode,
					label: product.name ?? product.internalCode ?? 'TBD',
				}))
				.filter((option): option is DropdownOption => Boolean(option.value)),
		[products],
	)

	const partnerOptions = useMemo<DropdownOption[]>(
		() =>
			partners
				.map(partner => ({
					value: partner.partnerId ?? partner.internalCode,
					label: partner.name ?? partner.internalCode ?? 'TBD',
				}))
				.filter((option): option is DropdownOption => Boolean(option.value)),
		[partners],
	)
	const expenseOptions = useMemo<DropdownOption[]>(
		() =>
			expenses
				.map(expense => ({
					value: expense.expenseId ?? expense.internalCode,
					label: expense.name ?? expense.internalCode ?? 'TBD',
				}))
				.filter((option): option is DropdownOption => Boolean(option.value)),
		[expenses],
	)

	useEffect(() => {
		if (hasInitializedCurrency.current) return

		if (formData?.currencyId) {
			hasInitializedCurrency.current = true
			return
		}

		const defaultCurrency = currencyOptions[0]
		if (!defaultCurrency) return

		handleDropdownChange(
			'currencyId',
			'currencyName',
			[defaultCurrency.value],
			currencyOptions,
		)
		hasInitializedCurrency.current = true
	}, [currencyOptions, formData?.currencyId, handleDropdownChange])

	useEffect(() => {
		if (hasInitializedUnit.current || (!isBuyingEntry && !isSellingEntry))
			return

		if (formData?.unitId) {
			hasInitializedUnit.current = true
			return
		}

		const defaultUnit = unitOptions[0]
		if (!defaultUnit) return

		handleDropdownChange('unitId', 'unitName', [defaultUnit.value], unitOptions)
		hasInitializedUnit.current = true
	}, [
		formData?.unitId,
		handleDropdownChange,
		isBuyingEntry,
		isSellingEntry,
		unitOptions,
	])

	useEffect(() => {
		if (
			hasInitializedCustomer.current ||
			!entryTargetId ||
			(!isSellingEntry && !isReceiptEntry)
		) {
			return
		}

		if (formData?.customerId || formData?.partnerId) {
			hasInitializedCustomer.current = true
			return
		}

		const defaultPartner = partnerOptions.find(
			option => option.value === entryTargetId,
		)
		if (defaultPartner) {
			handlePartnerOrEntityDropdownChange(
				[defaultPartner.value],
				partnerOptions,
				customerOptions,
				'customerId',
				'customerName',
			)
			hasInitializedCustomer.current = true
			return
		}

		const defaultCustomer = customerOptions.find(
			option => option.value === entryTargetId,
		)
		if (!defaultCustomer) return

		handleDropdownChange(
			'customerId',
			'customerName',
			[defaultCustomer.value],
			customerOptions,
		)
		hasInitializedCustomer.current = true
	}, [
		customerOptions,
		entryTargetId,
		formData?.customerId,
		formData?.partnerId,
		handleDropdownChange,
		handlePartnerOrEntityDropdownChange,
		isReceiptEntry,
		isSellingEntry,
		partnerOptions,
	])

	useEffect(() => {
		if (
			hasInitializedSupplier.current ||
			!entryTargetId ||
			(!isBuyingEntry && !isPaymentEntry)
		) {
			return
		}

		if (formData?.supplierId || formData?.partnerId) {
			hasInitializedSupplier.current = true
			return
		}

		const defaultPartner = partnerOptions.find(
			option => option.value === entryTargetId,
		)
		if (defaultPartner) {
			handlePartnerOrEntityDropdownChange(
				[defaultPartner.value],
				partnerOptions,
				supplierOptions,
				'supplierId',
				'supplierName',
			)
			hasInitializedSupplier.current = true
			return
		}

		const defaultSupplier = supplierOptions.find(
			option => option.value === entryTargetId,
		)
		if (!defaultSupplier) return

		handleDropdownChange(
			'supplierId',
			'supplierName',
			[defaultSupplier.value],
			supplierOptions,
		)
		hasInitializedSupplier.current = true
	}, [
		entryTargetId,
		formData?.supplierId,
		formData?.partnerId,
		handleDropdownChange,
		handlePartnerOrEntityDropdownChange,
		isBuyingEntry,
		isPaymentEntry,
		partnerOptions,
		supplierOptions,
	])

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
						{isBuyingEntry && (
							<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
								<TextLabel label={t('common.supplier')} />
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										isSingle={true}
										placeholder={t('common.supplierName')}
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
								<TextLabel label={t('common.customer')} />
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										isSingle={true}
										placeholder={t('common.customerName')}
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
							<TextLabel label={t('common.unit')} />
							<Box sx={dropdownStyles.dropDownContainer}>
								<Dropdown
									placeholder={t('common.unitName')}
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

						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<TextLabel label={t('common.currency')} />
							<Box sx={dropdownStyles.dropDownContainer}>
								<Dropdown
									placeholder={t('common.currencyName')}
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
					</SimpleGrid>

					<VStack alignItems="stretch" spacing={4} marginTop="1.5rem">
						{productLines.map((productLine, index) => {
							return (
								<Box
									key={productLine.id}
									border="1px solid #EAEAEA"
									padding="1rem"
								>
									<Box
										display="flex"
										alignItems="center"
										justifyContent="space-between"
										gap="1rem"
										marginBottom="1rem"
									>
										<Text fontWeight={700}>
											{t('components.daily.productLine', {
												number: index + 1,
											})}
										</Text>
										{productLines.length > 1 && (
											<Button
												size="sm"
												variant="outline"
												onClick={() => removeProductLine(productLine.id)}
											>
												{t('common.delete')}
											</Button>
										)}
									</Box>
									<SimpleGrid columns={[1, 2, 4]} gap={6}>
										<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
											<TextLabel label={t('common.product')} />
											<Box sx={dropdownStyles.dropDownContainer}>
												<Dropdown
													isSingle={true}
													placeholder={t('common.productName')}
													dropDownOptions={productOptions}
													selectedValues={
														productLine.productId ? [productLine.productId] : []
													}
													onSelect={(values: string[]) =>
														handleProductLineDropdownChange(
															productLine.id,
															'productId',
															'productName',
															values,
															productOptions,
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
												value={productLine.weight ?? ''}
												onChange={(value: string) =>
													handleProductLineInputChange(
														productLine.id,
														'weight',
														value,
													)
												}
											/>
										</VStack>
										<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
											<InputLabel
												withGap={true}
												label={t('common.singleUnitPrice')}
												inputPlaceholder={t('common.singleUnitPrice')}
												inputType={'number'}
												styles={documentNameStyles}
												value={productLine.singleUnitPrice ?? ''}
												onChange={(value: string) =>
													handleProductLineInputChange(
														productLine.id,
														'singleUnitPrice',
														parseNumberValue(value, 2),
													)
												}
											/>
										</VStack>
										<Box
											sx={{
												border: '3px solid #376288 ',
												padding: '0.5rem',
											}}
										>
											<TextLabel
												label={t('common.totalPrice')}
												value={mapFee(productLine.totalPrice)}
											/>
										</Box>
									</SimpleGrid>
									<VStack
										sx={{ gap: '1rem', alignItems: 'left', marginTop: '1rem' }}
									>
										<InputLabel
											withGap={true}
											label={t('common.note')}
											inputPlaceholder={t('common.notePlaceholder')}
											inputType={'text'}
											styles={documentNameStyles}
											value={productLine.note ?? ''}
											onChange={(value: string) =>
												handleProductLineInputChange(
													productLine.id,
													'note',
													value,
												)
											}
										/>
									</VStack>
								</Box>
							)
						})}

						<Button
							alignSelf="flex-start"
							variant="primary"
							sx={{ borderRadius: '0' }}
							onClick={addProductLine}
						>
							+ {t('components.daily.addProduct')}
						</Button>
					</VStack>

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
			{(isReceiptEntry || isPaymentEntry || isExpenseEntry) && (
				<>
					<Heading fontSize={'1rem'} marginBottom={'1rem'}>
						{isReceiptEntry
							? t('components.daily.receiptAction')
							: isPaymentEntry
								? t('components.daily.paymentAction')
								: t('components.daily.expenseAction')}
					</Heading>
					<SimpleGrid columns={[1, 2, 3]} gap={6}>
						{isPaymentEntry && (
							<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
								<TextLabel label={t('common.supplier')} />
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										isSingle={true}
										placeholder={t('common.supplierName')}
										dropDownOptions={[...partnerOptions, ...supplierOptions]}
										selectedValues={
											formData?.partnerId
												? [formData.partnerId]
												: formData?.supplierId
													? [formData.supplierId]
													: []
										}
										onSelect={(values: string[]) =>
											handlePartnerOrEntityDropdownChange(
												values,
												partnerOptions,
												supplierOptions,
												'supplierId',
												'supplierName',
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
										dropDownOptions={[...partnerOptions, ...customerOptions]}
										selectedValues={
											formData?.partnerId
												? [formData.partnerId]
												: formData?.customerId
													? [formData.customerId]
													: []
										}
										onSelect={(values: string[]) =>
											handlePartnerOrEntityDropdownChange(
												values,
												partnerOptions,
												customerOptions,
												'customerId',
												'customerName',
											)
										}
									/>
								</Box>
							</VStack>
						)}
						{isExpenseEntry && (
							<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
								<TextLabel label={t('common.expense')} />
								<Box sx={dropdownStyles.dropDownContainer}>
									<Dropdown
										isSingle={true}
										placeholder={t('common.expenseName')}
										dropDownOptions={expenseOptions}
										selectedValues={
											formData?.expenseId ? [formData.expenseId] : []
										}
										onSelect={(values: string[]) =>
											handleDropdownChange(
												'expenseId',
												'expenseName',
												values,
												expenseOptions,
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
								label={t('common.amount')}
								inputPlaceholder={t('common.amount')}
								inputType={'number'}
								styles={documentNameStyles}
								value={formData?.singleUnitPrice ?? ''}
								onChange={(value: string) =>
									handleInputChange(
										'singleUnitPrice',
										parseNumberValue(value, 2),
									)
								}
							/>
						</VStack>
						<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
							<InputLabel
								withGap={true}
								label={t('common.note')}
								inputPlaceholder={t('common.notePlaceholder')}
								inputType={'text'}
								styles={documentNameStyles}
								value={formData?.note ?? ''}
								onChange={(value: string) => handleInputChange('note', value)}
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
