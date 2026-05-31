import React, {
	Dispatch,
	SetStateAction,
	useEffect,
	useRef,
	useState,
} from 'react'
import TextLabel from '../common/TextLabel'
import { Box, Button, SimpleGrid, VStack } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { ActionTypes } from '../../shared/globalEnums'
import { Dropdown } from '../dropdown/Dropdown'
import { dropdownStyles } from '../filters/dropdowns/styles'
import InputLabel from '../common/InputLabel'
import {
	documentNameStyles,
	hoverFocusActiveButtonStyles,
} from '../../theme/styles'
import { AsCheckmarkCircleIcon } from '../../icons/CheckmarkCircle'
import {
	useGetProductsQuery,
	useGetSuppliersQuery,
	useGetCustomersQuery,
	useGetCurrenciesQuery,
	useGetUnitsQuery,
	useQuickAddProductMutation,
	useCreateSupplierMutation,
	useCreateCustomerMutation,
	useCreateCurrencyMutation,
	useCreateUnitMutation,
} from '../../api/apiStore'

const styles = {
	button: {
		margin: { base: '0 0 1rem 2rem', md: '1rem' },
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
}
const DailyActionDataTab = ({
	actionType,
	setShouldLeavingBeQuestioned,
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

	const productOptions = (productsResponse?.products ?? []).map(p => ({
		label: p.name,
		value: String((p as any)._id ?? p.productId ?? p.name),
	}))

	const supplierOptions = suppliersData ?? []
	const customerOptions = customersData ?? []
	const currencyOptions = currenciesData ?? []
	const unitOptions = unitsData ?? []

	const [formData, setFormData] = useState<any>(null)
	const hasMountedRef = useRef(false)
	const [selectedValues, setSelectedValues] = useState({
		product: [] as string[],
		supplier: [] as string[],
		customer: [] as string[],
		currency: [] as string[],
		unit: [] as string[],
	})

	const handleSelectionChange = (
		field: keyof typeof selectedValues,
		values: string[],
	) => {
		setSelectedValues(prevValues => ({
			...prevValues,
			[field]: values,
		}))
		setFormData((prevData: any) => ({
			...prevData,
			[field]: values,
		}))
	}

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

		try {
			await quickAddProduct({
				name,
				currency,
				unit,
				supplierId: selectedValues.supplier[0],
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

	const purchaseAction = () => {
		return (
			<>
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
						<TextLabel label={' Supplier'} />
						<Box sx={dropdownStyles.dropDownContainer}>
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
							label={'Unit Type'}
							inputPlaceholder={'Unit Type'}
							inputType={'text'}
							styles={documentNameStyles}
							value={'documentName'}
							onChange={() => {}}
						/>
					</VStack>
				</SimpleGrid>

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
			</>
		)
	}

	const procurementAction = () => {
		return (
			<>
				<SimpleGrid columns={[1, 2, 3]} gap={6}>
					<VStack>
						<InputLabel
							label={'Payment Amount'}
							inputPlaceholder={'Enter amount'}
							inputType={'number'}
							styles={documentNameStyles}
							value={'amount'}
							onChange={() => {}}
						/>
					</VStack>
					<VStack>
						<InputLabel
							label={'Reference'}
							inputPlaceholder={'Payment Reference'}
							inputType={'text'}
							styles={documentNameStyles}
							value={'reference'}
							onChange={() => {}}
						/>
					</VStack>
					<VStack>
						<InputLabel
							label={'Description'}
							inputPlaceholder={'Description'}
							inputType={'text'}
							styles={documentNameStyles}
							value={'description'}
							onChange={() => {}}
						/>
					</VStack>
				</SimpleGrid>
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
			</>
		)
	}

	const expenseAction = () => {
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

	return (
		<>
			{actionType === ActionTypes.purchase && purchaseAction()}
			{actionType === ActionTypes.procurement && procurementAction()}
			{actionType === ActionTypes.receipt && receiptAction()}
			{actionType === ActionTypes.expense && expenseAction()}
			{actionType === ActionTypes.test && testAction()}
		</>
	)
}

export default DailyActionDataTab
