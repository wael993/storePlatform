import React, {
	Dispatch,
	SetStateAction,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'

import {
	Box,
	Button,
	SimpleGrid,
	VStack,
	Heading,
	Text,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import {
	documentNameStyles,
	hoverFocusActiveButtonStyles,
} from '../../../theme/styles'
import {
	useCreateCurrencyMutation,
	useCreateCustomerMutation,
	useCreateSupplierMutation,
	useCreateUnitMutation,
	useGetCurrenciesQuery,
	useGetCustomersQuery,
	useGetProductsQuery,
	useGetSuppliersQuery,
	useGetUnitsQuery,
	useQuickAddProductMutation,
} from '../../../api/apiStore'
import { AsCheckmarkCircleIcon } from '../../../icons/CheckmarkCircle'
import { ActionTypes } from '../../../shared/globalEnums'
import { mapFee } from '../../../shared/utils'
import InputLabel from '../../common/InputLabel'
import TextLabel from '../../common/TextLabel'
import { Dropdown } from '../../dropdown/Dropdown'
import { dropdownStyles } from '../../filters/dropdowns/styles'

const styles = {
	button: {
		margin: { base: '0 0 1rem 2rem', md: '1rem 1rem 1rem 0rem' },
		backgroundColor: '#376288',
		fontSize: '0.875rem',
		p: { base: '4', md: '1rem 1.5rem 1rem 1.5rem' },
		whiteSpace: 'nowrap',
		borderRadius: '0',
		...hoverFocusActiveButtonStyles,
	},
}
interface DailyActionDataTabProps {
	actionType: string
	setShouldLeavingBeQuestioned: Dispatch<SetStateAction<boolean>>
	registerNextStepValidation: (validator: () => boolean) => void
	onSummaryChange: (summary: DailyActionSummary) => void
}

export interface DailyActionSummary {
	actionType: string
	product: string
	supplier: string
	customer: string
	currency: string
	unit: string
	weight: string
	singleUnitPrice: string
	totalPrice: string
	salesArea: string
	locationCustomer: string
}

const DailyActionDataTab = ({
	actionType,
	setShouldLeavingBeQuestioned,
	registerNextStepValidation,
	onSummaryChange,
}: DailyActionDataTabProps) => {
	const { t } = useTranslation()

	const { data: productsResponse } = useGetProductsQuery({})
	const { data: suppliersData } = useGetSuppliersQuery()
	const { data: customersData } = useGetCustomersQuery()
	const { data: currenciesData } = useGetCurrenciesQuery()
	const { data: unitsData } = useGetUnitsQuery()

	const [quickAddProduct] = useQuickAddProductMutation()
	const [createSupplier] = useCreateSupplierMutation()
	const [createCustomer] = useCreateCustomerMutation()
	const [createCurrency] = useCreateCurrencyMutation()
	const [createUnit] = useCreateUnitMutation()

	const productOptions = useMemo(
		() =>
			(productsResponse?.products ?? []).map(p => ({
				label: p.name,
				value: String((p as any)._id ?? p.productId ?? p.name),
			})),
		[productsResponse?.products],
	)

	const supplierOptions = useMemo(() => suppliersData ?? [], [suppliersData])
	const customerOptions = useMemo(() => customersData ?? [], [customersData])
	const currencyOptions = useMemo(() => currenciesData ?? [], [currenciesData])
	const unitOptions = useMemo(() => unitsData ?? [], [unitsData])

	const [formData, setFormData] = useState<any>(null)
	const hasMountedRef = useRef(false)
	const [selectedValues, setSelectedValues] = useState({
		product: [] as string[],
		supplier: [] as string[],
		customer: [] as string[],
		currency: [] as string[],
		unit: [] as string[],
	})
	const [requiredErrors, setRequiredErrors] = useState({
		product: false,
		supplier: false,
		currency: false,
		unit: false,
		weight: false,
		singleUnitPrice: false,
	})

	const handleSelectionChange = (
		field: keyof typeof selectedValues,
		values: string[],
	) => {
		if (values.length > 0) {
			setRequiredErrors(prevErrors => ({
				...prevErrors,
				[field]: false,
			}))
		}

		setSelectedValues(prevValues => ({
			...prevValues,
			[field]: values,
		}))
		setFormData((prevData: any) => ({
			...prevData,
			[field]: values,
		}))
	}

	const handleInputChange = (
		field: 'weight' | 'singleUnitPrice',
		value: string,
	) => {
		if (value.trim()) {
			setRequiredErrors(prevErrors => ({
				...prevErrors,
				[field]: false,
			}))
		}

		setFormData((prev: any) => ({
			...prev,
			[field]: value,
		}))
	}

	useEffect(() => {
		registerNextStepValidation(() => {
			if (actionType !== ActionTypes.buying) {
				return true
			}

			const validationErrors = {
				product: selectedValues.product.length === 0,
				supplier: selectedValues.supplier.length === 0,
				currency: selectedValues.currency.length === 0,
				unit: selectedValues.unit.length === 0,
				weight: !String(formData?.weight ?? '').trim(),
				singleUnitPrice: !String(formData?.singleUnitPrice ?? '').trim(),
			}

			setRequiredErrors(validationErrors)

			return !Object.values(validationErrors).some(Boolean)
		})
	}, [
		selectedValues.product.length,
		actionType,
		formData?.singleUnitPrice,
		formData?.weight,
		registerNextStepValidation,
		selectedValues.currency.length,
		selectedValues.supplier.length,
		selectedValues.unit.length,
	])

	useEffect(() => {
		if (actionType !== ActionTypes.buying) {
			setRequiredErrors({
				product: false,
				supplier: false,
				currency: false,
				unit: false,
				weight: false,
				singleUnitPrice: false,
			})
		}
	}, [actionType])

	const showSupplierWarningBorder = requiredErrors.supplier
	const showCurrencyWarningBorder = requiredErrors.currency
	const showUnitWarningBorder = requiredErrors.unit
	const showWeightWarningBorder = requiredErrors.weight
	const showSingleUnitPriceWarningBorder = requiredErrors.singleUnitPrice
	const showProductWarningBorder = requiredErrors.product
	const showWarningBorder = Object.values(requiredErrors).some(Boolean)

	const getLabelByValue = (
		options: Array<{ label: string; value: string }>,
		value?: string,
	): string => {
		if (!value) {
			return ''
		}

		return options.find(option => option.value === value)?.label || value
	}

	useEffect(() => {
		const totalPrice =
			formData?.singleUnitPrice && formData?.weight
				? mapFee(
						(
							Number(formData.singleUnitPrice) * Number(formData.weight)
						)?.toString(),
					) || ''
				: ''

		onSummaryChange({
			actionType,
			product: getLabelByValue(productOptions, selectedValues.product[0]),
			supplier: getLabelByValue(supplierOptions, selectedValues.supplier[0]),
			customer: getLabelByValue(customerOptions, selectedValues.customer[0]),
			currency: getLabelByValue(currencyOptions, selectedValues.currency[0]),
			unit: getLabelByValue(unitOptions, selectedValues.unit[0]),
			weight: String(formData?.weight ?? '').trim(),
			singleUnitPrice: String(formData?.singleUnitPrice ?? '').trim(),
			totalPrice,
			salesArea: String(formData?.salesArea ?? '').trim(),
			locationCustomer: String(formData?.locationCustomer ?? '').trim(),
		})
	}, [
		actionType,
		customerOptions,
		currencyOptions,
		formData?.locationCustomer,
		formData?.salesArea,
		formData?.singleUnitPrice,
		formData?.weight,
		onSummaryChange,
		productOptions,
		selectedValues.currency,
		selectedValues.customer,
		selectedValues.product,
		selectedValues.supplier,
		selectedValues.unit,
		supplierOptions,
		unitOptions,
	])

	useEffect(() => {
		if (!hasMountedRef.current) {
			hasMountedRef.current = true
			setShouldLeavingBeQuestioned(false)
			return
		}

		setShouldLeavingBeQuestioned(true)
	}, [formData, setShouldLeavingBeQuestioned])

	const askName = (label: string): string | null => {
		const value = window.prompt(`Enter ${label} name`)
		if (!value || !value.trim()) {
			return null
		}

		return value.trim()
	}

	const addProduct = async () => {
		const name = askName('product')
		if (!name) return

		const currency = selectedValues.currency[0] || 'EUR'
		const selectedUnit = selectedValues.unit[0]
		const unit =
			selectedUnit === 'kg' ||
			selectedUnit === 'piece' ||
			selectedUnit === 'meter' ||
			selectedUnit === 'set' ||
			selectedUnit === 'mm'
				? selectedUnit
				: 'piece'
		const singleUnitPrice = Number(formData?.singleUnitPrice || 0)
		const weight = String(formData?.weight || '').trim()

		try {
			await quickAddProduct({
				name,
				currency,
				unit,
				supplierId: selectedValues.supplier[0],
				singleUnitPrice: Number.isFinite(singleUnitPrice) ? singleUnitPrice : 0,
				weight,
			}).unwrap()
		} catch (error) {
			console.error('Failed to add product', error)
		}
	}

	const addSupplier = async () => {
		const name = askName('supplier')
		if (!name) return

		try {
			await createSupplier({ name }).unwrap()
		} catch (error) {
			console.error('Failed to add supplier', error)
		}
	}
	const addCustomer = async () => {
		const name = askName('customer')
		if (!name) return

		try {
			await createCustomer({ name }).unwrap()
		} catch (error) {
			console.error('Failed to add customer', error)
		}
	}
	const addCurrency = async () => {
		const codeInput = window.prompt('Enter currency code (e.g. EUR)')
		if (!codeInput || !codeInput.trim()) return

		const code = codeInput.trim().toUpperCase()
		const labelInput = window.prompt(
			`Enter currency label for ${code} (optional)`,
		)
		const label = labelInput?.trim() || code

		try {
			await createCurrency({ code, label }).unwrap()
		} catch (error) {
			console.error('Failed to add currency', error)
		}
	}
	const addUnit = async () => {
		const name = askName('unit')
		if (!name) return

		try {
			await createUnit({ name }).unwrap()
		} catch (error) {
			console.error('Failed to add unit', error)
		}
	}
	const buyingAction = () => {
		return (
			<>
				<Heading fontSize={'1rem'} marginBottom={'1rem'}>
					Buying Action
				</Heading>
				<SimpleGrid columns={[1, 2, 3]} gap={6}>
					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<TextLabel label={' Product'} />
						<Box
							sx={{
								...dropdownStyles.dropDownContainer,
								outline: showProductWarningBorder
									? '1px solid #FF0000'
									: 'none',
							}}
						>
							<Dropdown
								isSingle={true}
								placeholder={t('Product Name')}
								dropDownOptions={productOptions}
								selectedValues={selectedValues.product}
								onSelect={(values: string[]) =>
									handleSelectionChange('product', values)
								}
							/>
						</Box>
					</VStack>
					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<TextLabel label={' Supplier'} />
						<Box
							sx={{
								...dropdownStyles.dropDownContainer,
								outline: showSupplierWarningBorder
									? '1px solid #FF0000'
									: 'none',
							}}
						>
							<Dropdown
								isSingle={true}
								placeholder={t('Supplier Name')}
								dropDownOptions={supplierOptions}
								selectedValues={selectedValues.supplier}
								onSelect={(values: string[]) =>
									handleSelectionChange('supplier', values)
								}
							/>
						</Box>
					</VStack>
					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<TextLabel label={' Currency'} />
						<Box
							sx={{
								...dropdownStyles.dropDownContainer,
								outline: showCurrencyWarningBorder
									? '1px solid #FF0000'
									: 'none',
							}}
						>
							<Dropdown
								placeholder={t('Currency Name')}
								dropDownOptions={currencyOptions}
								isSingle
								selectedValues={selectedValues.currency}
								onSelect={(values: string[]) =>
									handleSelectionChange('currency', values)
								}
							/>
						</Box>
					</VStack>
					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<TextLabel label={' Unit'} />
						<Box
							sx={{
								...dropdownStyles.dropDownContainer,
								outline: showUnitWarningBorder ? '1px solid #FF0000' : 'none',
							}}
						>
							<Dropdown
								placeholder={t('Unit Name')}
								dropDownOptions={unitOptions}
								selectedValues={selectedValues.unit}
								isSingle={true}
								onSelect={(values: string[]) =>
									handleSelectionChange('unit', values)
								}
							/>
						</Box>
					</VStack>
					<VStack sx={{ gap: '1.25rem', alignItems: 'left' }}>
						<InputLabel
							withGap={true}
							isInvalid={showWeightWarningBorder}
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
							isInvalid={showSingleUnitPriceWarningBorder}
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
					<TextLabel
						label={'Total Price'}
						value={
							formData?.singleUnitPrice && formData?.weight
								? mapFee(
										(
											Number(formData.singleUnitPrice) * Number(formData.weight)
										)?.toString(),
									)
								: ''
						}
					/>
				</Box>

				{showWarningBorder && (
					<Text
						color="#FF0000"
						fontSize="0.75rem"
						alignSelf="flex-start"
						paddingTop={'3rem'}
					>
						Please fill out the required fields.
					</Text>
				)}
				{footerActionsButtons()}
			</>
		)
	}
	const sellingAction = () => {
		return (
			<>
				<Heading fontSize={'1rem'} marginBottom={'1rem'}>
					Selling Action
				</Heading>
				<SimpleGrid columns={[1, 2, 3]} gap={6}>
					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<TextLabel label={' Product'} />
						<Box sx={dropdownStyles.dropDownContainer}>
							<Dropdown
								isSingle={true}
								placeholder={t('Product Name')}
								dropDownOptions={productOptions}
								selectedValues={selectedValues.product}
								onSelect={(values: string[]) =>
									handleSelectionChange('product', values)
								}
							/>
						</Box>
					</VStack>
					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<TextLabel label={' Customer'} />
						<Box sx={dropdownStyles.dropDownContainer}>
							<Dropdown
								placeholder={t('Customer Name')}
								dropDownOptions={customerOptions}
								selectedValues={selectedValues.customer}
								onSelect={(values: string[]) =>
									handleSelectionChange('customer', values)
								}
								isSingle={true}
							/>
						</Box>
					</VStack>
					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<TextLabel label={' Currency'} />
						<Box sx={dropdownStyles.dropDownContainer}>
							<Dropdown
								placeholder={t('Currency Name')}
								dropDownOptions={currencyOptions}
								isSingle
								selectedValues={selectedValues.currency}
								onSelect={(values: string[]) =>
									handleSelectionChange('currency', values)
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
								selectedValues={selectedValues.unit}
								isSingle={true}
								onSelect={(values: string[]) =>
									handleSelectionChange('unit', values)
								}
							/>
						</Box>
					</VStack>
					<VStack>
						<InputLabel
							withGap={true}
							label={'Weight'}
							inputPlaceholder={'Weight'}
							inputType={'number'}
							styles={documentNameStyles}
							value={formData?.weight ?? ''}
							onChange={(value: string) =>
								setFormData((prev: any) => ({
									...prev,
									weight: value,
								}))
							}
						/>
					</VStack>
					<VStack>
						<InputLabel
							withGap={true}
							label={'Single Unit Price'}
							inputPlaceholder={'Single Unit Price'}
							inputType={'number'}
							styles={documentNameStyles}
							value={formData?.singleUnitPrice ?? ''}
							onChange={(value: string) =>
								setFormData((prev: any) => ({
									...prev,
									singleUnitPrice: value,
								}))
							}
						/>
					</VStack>
				</SimpleGrid>
				{footerActionsButtons()}
			</>
		)
	}
	const PaymentAction = () => {
		return (
			<>
				<SimpleGrid columns={[1, 2, 3]} gap={6}>
					<VStack>
						<InputLabel
							label={'Expense Amount'}
							inputPlaceholder={'Enter amount'}
							inputType={'number'}
							styles={documentNameStyles}
							value={'amount'}
							onChange={() => {}}
						/>
					</VStack>
					<VStack>
						<InputLabel
							label={'Category'}
							inputPlaceholder={'Expense Category'}
							inputType={'text'}
							styles={documentNameStyles}
							value={'category'}
							onChange={() => {}}
						/>
					</VStack>
					<VStack>
						<InputLabel
							label={'Description'}
							inputPlaceholder={'Expense Description'}
							inputType={'text'}
							styles={documentNameStyles}
							value={'description'}
							onChange={() => {}}
						/>
					</VStack>
				</SimpleGrid>
				{footerActionsButtons()}
			</>
		)
	}
	const receiptAction = () => {
		return (
			<>
				<SimpleGrid columns={[1, 2, 3]} gap={6}>
					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<InputLabel
							label={'Sales Area'}
							inputPlaceholder={t('Sales Area')}
							inputType={'text'}
							styles={documentNameStyles}
							value={formData?.salesArea ?? ''}
							onChange={(value: string) =>
								setFormData((prev: any) => ({
									...prev,
									salesArea: value,
								}))
							}
						/>
					</VStack>
					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<InputLabel
							label={'Location/Customer'}
							inputPlaceholder={t('Location/Customer')}
							inputType={'text'}
							styles={documentNameStyles}
							value={formData?.locationCustomer ?? ''}
							onChange={(value: string) =>
								setFormData((prev: any) => ({
									...prev,
									locationCustomer: value,
								}))
							}
						/>
					</VStack>
					<VStack>
						<InputLabel
							label={'Description'}
							inputPlaceholder={'Receipt Description'}
							inputType={'text'}
							styles={documentNameStyles}
							value={'description'}
							onChange={() => {}}
						/>
					</VStack>
				</SimpleGrid>
				{footerActionsButtons()}
			</>
		)
	}
	const testAction = () => {
		return (
			<SimpleGrid columns={[1, 2, 3]} gap={6}>
				<TextLabel label={'Test Action - No data required'} />
			</SimpleGrid>
		)
	}
	const footerActionsButtons = () => {
		return (
			<SimpleGrid columns={[1, 2, 3]} gap={6} sx={{ marginTop: '2rem' }}>
				<Button
					rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
					size={'md'}
					variant={'primary'}
					onClick={addProduct}
					sx={{
						...styles.button,
						backgroundColor: '#376288',
						color: '#FFFFFF',
					}}
				>
					Add Product
				</Button>
				<Button
					rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
					size={'md'}
					variant={'primary'}
					onClick={addCurrency}
					sx={{
						...styles.button,
						backgroundColor: '#376288',
						color: '#FFFFFF',
					}}
				>
					Add Currency
				</Button>
				<Button
					rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
					size={'md'}
					variant={'primary'}
					onClick={addSupplier}
					sx={{
						...styles.button,
						backgroundColor: '#376288',
						color: '#FFFFFF',
					}}
				>
					Add Supplier
				</Button>
				<Button
					rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
					size={'md'}
					variant={'primary'}
					onClick={addCustomer}
					sx={{
						...styles.button,
						backgroundColor: '#376288',
						color: '#FFFFFF',
					}}
				>
					Add Customer
				</Button>
				<Button
					rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
					size={'md'}
					variant={'primary'}
					onClick={addUnit}
					sx={{
						...styles.button,
						backgroundColor: '#376288',
						color: '#FFFFFF',
					}}
				>
					Add Unit
				</Button>
			</SimpleGrid>
		)
	}

	return (
		<>
			{actionType === ActionTypes.buying && buyingAction()}
			{actionType === ActionTypes.selling && sellingAction()}
			{actionType === ActionTypes.Payment && PaymentAction()}
			{actionType === ActionTypes.receipt && receiptAction()}
			{actionType === ActionTypes.test && testAction()}
		</>
	)
}

export default DailyActionDataTab
