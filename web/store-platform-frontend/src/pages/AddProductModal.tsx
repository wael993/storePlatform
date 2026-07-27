import {
	Modal,
	ModalOverlay,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
	Button,
	Text,
	VStack,
	HStack,
	Divider,
	Heading,
	ModalCloseButton,
	SimpleGrid,
} from '@chakra-ui/react'
import { useState, useEffect, useMemo } from 'react'
import {
	usePostProductMutation,
	useGetBrandsQuery,
	useGetCategoriesQuery,
	useGetSuppliersQuery,
	useGetUnitsQuery,
	useGetCurrenciesQuery,
	useGetCurrencySettingsQuery,
} from '../api/apiStore'
import { useTranslation } from 'react-i18next'
import InputLabel from '../components/common/InputLabel'
import DropdownLabel from '../components/DropdownLabel'
import MultiStepper from '../components/common/MultiStepper'
import { hoverFocusActiveButtonStyles } from '../theme/styles'
import { ChevronRightIcon } from '../components/icons/ChevronRight'
import { ChevronLeftIcon } from '../components/icons/ChevronLeftIcon'
import { useSettings } from '../shared/context/SettingsContext'
import {
	buildDisplayCurrencyOptions,
	resolveDefaultDisplayCurrencyId,
} from '../components/SellingInvoice/currencyDisplay'

const TOTAL_STEPS = 3

const INITIAL_FORM = {
	name: '',
	latinName: '',
	barcode: '',
	internalCode: '',
	productFactoryCode: '',
	categoryId: '',
	supplierId: '',
	brandId: '',
	taxRate: '0',
	unitId: '',
	quantity: '',
	minQuantity: '',
	price: {
		purchasePrice: '',
		retailPrice: '',
		wholesalePrice: '',
		semiWholesalePrice: '',
		discount: '',
		currency: '',
	},
	status: 'active' as 'active' | 'inactive' | 'discontinued',
	attributes: {
		color: '',
		size: '',
		weight: '',
		length: '',
		width: '',
		height: '',
		flavor: '',
		expiryDate: '',
	},
	description: '',
}

const styles = {
	header: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: '0.625rem',
		borderBottom: '1px solid #EAEAEA',
	},
	headerTitleStepperContainer: {
		alignItems: 'flex-start',
		gap: '0.625rem',
	},
	headerText: {
		fontWeight: 700,
		fontSize: '1.25rem',
	},
	body: {
		minHeight: '24rem',
		padding: '1.25rem',
	},
	modalCloseButton: { marginTop: '0.9rem', marginRight: '0.4rem' },
	bodyHeading: {
		fontWeight: 700,
		fontSize: '1rem',
		marginBottom: '0.5rem',
	},
	footer: {
		gap: '0.5rem',
		borderTop: '1px solid #EAEAEA',
	},
	button: {
		backgroundColor: '#376288',
		fontSize: '0.875rem',
		color: '#FFFFFF',
		p: '1rem 1.5rem',
		whiteSpace: 'nowrap',
		borderRadius: '0',
		...hoverFocusActiveButtonStyles,
	},
	secondaryButton: {
		backgroundColor: '#EAEAEA',
		color: '#1E1E1E',
	},
} satisfies StylesObject

interface AddProductModalProps {
	isOpen: boolean
	onClose: () => void
	barcode: string
	onSuccess?: () => void
}

const AddProductModal = ({
	isOpen,
	onClose,
	barcode,
	onSuccess,
}: AddProductModalProps) => {
	const { t } = useTranslation()
	const [postNewProduct, { isLoading }] = usePostProductMutation()
	const [error, setError] = useState('')
	const [step, setStep] = useState(0)
	const [form, setForm] = useState(INITIAL_FORM)

	const { data: categories = [], isLoading: isCategoriesLoading } =
		useGetCategoriesQuery(undefined, { skip: !isOpen })
	const { data: suppliers = [], isLoading: isSuppliersLoading } =
		useGetSuppliersQuery({}, { skip: !isOpen })
	const { data: units = [], isLoading: isUnitsLoading } = useGetUnitsQuery(
		{},
		{ skip: !isOpen },
	)
	const { data: currencies = [], isLoading: isCurrenciesLoading } =
		useGetCurrenciesQuery({}, { skip: !isOpen })
	const { defaultInvoiceCurrencyId } = useSettings()
	const { data: currencySettings } = useGetCurrencySettingsQuery(undefined, {
		skip: !isOpen,
		refetchOnMountOrArgChange: false,
	})

	const categoryOptions = useMemo(
		() =>
			categories.map(category => ({
				value: category.categoryId,
				label: category.name,
			})),
		[categories],
	)

	const supplierOptions = useMemo(
		() =>
			suppliers.map(supplier => ({
				value: supplier.supplierId,
				label: supplier.name,
			})),
		[suppliers],
	)

	const unitOptions = useMemo(
		() =>
			units.map(unit => ({
				value: unit.unitId ?? unit.internalCode,
				label: unit.name,
			})),
		[units],
	)

	const currencyOptions = useMemo(
		() =>
			currencies.map(currency => ({
				value: currency.internalCode || currency.name,
				label: currency.name,
			})),
		[currencies],
	)

	const { data: brands = [], isLoading: isBrandsLoading } = useGetBrandsQuery(
		undefined,
		{ skip: !isOpen },
	)

	const defaultCurrencyCode = useMemo(() => {
		const options = buildDisplayCurrencyOptions(currencySettings)
		const currencyId = resolveDefaultDisplayCurrencyId(
			options,
			defaultInvoiceCurrencyId,
		)

		if (!currencyId) {
			return ''
		}

		const match = currencies.find(
			currency => currency.currencyId === currencyId,
		)

		if (match) {
			return match.internalCode || match.name
		}

		const settingsItem = [
			currencySettings?.primaryCurrency,
			...(currencySettings?.secondaryCurrencies ?? []),
		].find(currency => currency?.currencyId === currencyId)

		return settingsItem ? settingsItem.internalCode || settingsItem.name : ''
	}, [currencySettings, defaultInvoiceCurrencyId, currencies])

	const brandOptions = useMemo(
		() =>
			brands.map(brand => ({
				value: brand.brandId,
				label: brand.name,
			})),
		[brands],
	)

	const statusOptions = useMemo(
		() => [
			{ value: 'active', label: t('common.active') },
			{ value: 'inactive', label: t('common.inactive') },
			{
				value: 'discontinued',
				label: t('components.product.states.discontinued'),
			},
		],
		[t],
	)

	const stepHeadings = [
		t('productModal.tabBasicInfo'),
		t('productModal.tabClassification'),
		t('productModal.tabDetails'),
	]

	useEffect(() => {
		if (!isOpen) {
			setError('')
			setStep(0)
			setForm(INITIAL_FORM)
			return
		}

		setForm(prev => ({
			...prev,
			barcode: barcode || prev.barcode,
			price: {
				...prev.price,
				currency: prev.price.currency || defaultCurrencyCode,
			},
		}))
	}, [isOpen, barcode, defaultCurrencyCode])

	const handleFieldChange = (key: keyof typeof INITIAL_FORM, value: string) => {
		setForm(prev => ({ ...prev, [key]: value }))
	}

	const handlePriceChange = (
		key: keyof typeof INITIAL_FORM.price,
		value: string,
	) => {
		setForm(prev => ({
			...prev,
			price: { ...prev.price, [key]: value },
		}))
	}

	const handleAttributeChange = (
		key: keyof typeof INITIAL_FORM.attributes,
		value: string,
	) => {
		setForm(prev => ({
			...prev,
			attributes: { ...prev.attributes, [key]: value },
		}))
	}

	const handleDropdownSelect = (
		field: keyof typeof INITIAL_FORM,
		values: string[],
	) => {
		setForm(prev => ({ ...prev, [field]: values[0] ?? '' }))
	}

	const handleCurrencySelect = (values: string[]) => {
		setForm(prev => ({
			...prev,
			price: {
				...prev.price,
				currency: values[0] ?? defaultCurrencyCode,
			},
		}))
	}

	const getSelectedOption = (
		options: DropdownOption[],
		value: string,
	): DropdownOption[] => {
		if (!value) return []
		const match = options.find(option => option.value === value)
		return match ? [match] : [{ value, label: value }]
	}

	const validateForm = (): boolean => {
		if (!form.name.trim() && !form.latinName.trim()) {
			setError(t('productModal.nameOrLatinNameRequired'))
			return false
		}

		if (!form.price.retailPrice.trim()) {
			setError(t('productModal.retailPriceRequired'))
			return false
		}

		if (!form.quantity.trim() || Number(form.quantity) < 0) {
			setError(t('productModal.quantityRequired'))
			return false
		}

		if (
			form.minQuantity.trim() &&
			(Number.isNaN(Number(form.minQuantity)) || Number(form.minQuantity) < 0)
		) {
			setError(t('productModal.minQuantityInvalid'))
			return false
		}

		return true
	}

	const resetForm = () => {
		setForm({
			...INITIAL_FORM,
			barcode: barcode || '',
			price: { ...INITIAL_FORM.price, currency: defaultCurrencyCode },
		})
		setStep(0)
		setError('')
	}

	const handleSubmit = async () => {
		setError('')

		if (!validateForm()) {
			return
		}

		try {
			await postNewProduct({
				name: form.name.trim() || form.latinName.trim(),
				latinName: form.latinName.trim() || undefined,
				productFactoryCode: form.productFactoryCode.trim() || undefined,
				barcode: form.barcode.trim(),
				internalCode: form.internalCode.trim() || undefined,
				categoryId: form.categoryId.trim() || undefined,
				brandId: form.brandId.trim() || undefined,
				images: [],
				price: {
					wholesalePrice: form.price.wholesalePrice
						? Number(form.price.wholesalePrice)
						: undefined,
					retailPrice: Number(form.price.retailPrice),
					semiWholesalePrice: form.price.semiWholesalePrice
						? Number(form.price.semiWholesalePrice)
						: undefined,
					purchasePrice: form.price.purchasePrice
						? Number(form.price.purchasePrice)
						: undefined,
					discount: form.price.discount
						? Number(form.price.discount)
						: undefined,
					currency:
						form.price.currency.trim() ||
						defaultCurrencyCode ||
						currencyOptions[0]?.value ||
						'',
				},
				quantity: Number(form.quantity),
				minQuantity: form.minQuantity.trim()
					? Number(form.minQuantity)
					: undefined,
				unitId: form.unitId.trim() || undefined,
				taxRate: form.taxRate.trim() || undefined,
				supplierId: form.supplierId.trim() || undefined,
				attributes: {
					color: form.attributes.color.trim() || undefined,
					size: form.attributes.size.trim() || undefined,
					weight: form.attributes.weight.trim() || undefined,
					length: form.attributes.length.trim() || undefined,
					width: form.attributes.width.trim() || undefined,
					height: form.attributes.height.trim() || undefined,
					flavor: form.attributes.flavor.trim() || undefined,
					expiryDate: form.attributes.expiryDate.trim() || undefined,
				},
				status: form.status,
				description: form.description.trim() || undefined,
			}).unwrap()
		} catch (submitError) {
			const err = submitError as { data?: { message?: string } }
			setError(err?.data?.message || t('productModal.createFailed'))
			return
		}

		resetForm()

		if (onSuccess) {
			onSuccess()
			return
		}

		onClose()
	}

	const renderBasicInfoStep = () => (
		<VStack spacing={4} align="stretch">
			<InputLabel
				inputType="text"
				label={t('common.productName')}
				value={form.name}
				onChange={value => handleFieldChange('name', value)}
			/>
			<InputLabel
				inputType="text"
				label={t('productModal.latinName')}
				value={form.latinName}
				onChange={value => handleFieldChange('latinName', value)}
			/>
			<InputLabel
				inputType="text"
				label={t('common.barcode')}
				value={form.barcode}
				isReadOnly
			/>
			<InputLabel
				inputType="text"
				label={t('productModal.internalCode')}
				value={form.internalCode}
				onChange={value => handleFieldChange('internalCode', value)}
			/>
			<InputLabel
				inputType="text"
				label={t('productModal.productFactoryCode')}
				value={form.productFactoryCode}
				onChange={value => handleFieldChange('productFactoryCode', value)}
			/>

			<Divider />

			<Text sx={styles.bodyHeading}>{t('productModal.pricingSection')}</Text>

			<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
				<InputLabel
					inputType="number"
					label={t('productModal.retailPrice')}
					value={form.price.retailPrice}
					onChange={value => handlePriceChange('retailPrice', value)}
				/>
				<InputLabel
					inputType="number"
					label={t('common.stockQuantity')}
					value={form.quantity}
					onChange={value => handleFieldChange('quantity', value)}
				/>
				<InputLabel
					inputType="number"
					label={t('common.stockMinQuantity')}
					value={form.minQuantity}
					onChange={value => handleFieldChange('minQuantity', value)}
				/>
				<InputLabel
					inputType="number"
					label={t('productModal.purchasePrice')}
					value={form.price.purchasePrice}
					onChange={value => handlePriceChange('purchasePrice', value)}
				/>
				<InputLabel
					inputType="number"
					label={t('productModal.wholesalePrice')}
					value={form.price.wholesalePrice}
					onChange={value => handlePriceChange('wholesalePrice', value)}
				/>
				<InputLabel
					inputType="number"
					label={t('productModal.semiWholesalePrice')}
					value={form.price.semiWholesalePrice}
					onChange={value => handlePriceChange('semiWholesalePrice', value)}
				/>
				<InputLabel
					inputType="number"
					label={t('productModal.discountPrice')}
					value={form.price.discount}
					onChange={value => handlePriceChange('discount', value)}
				/>
			</SimpleGrid>
		</VStack>
	)

	const renderClassificationStep = () => (
		<VStack spacing={4} align="stretch">
			<DropdownLabel
				isSearchable
				isSingle
				label={t('common.category')}
				placeholder={t('common.category')}
				options={categoryOptions}
				selectedOptions={getSelectedOption(categoryOptions, form.categoryId)}
				onSelect={values => handleDropdownSelect('categoryId', values)}
				isLoading={isCategoriesLoading}
			/>
			<DropdownLabel
				isSearchable
				isSingle
				label={t('common.supplier')}
				placeholder={t('common.supplier')}
				options={supplierOptions}
				selectedOptions={getSelectedOption(supplierOptions, form.supplierId)}
				onSelect={values => handleDropdownSelect('supplierId', values)}
				isLoading={isSuppliersLoading}
			/>
			<DropdownLabel
				isSearchable
				isSingle
				label={t('common.brand')}
				placeholder={t('common.brand')}
				options={brandOptions}
				selectedOptions={getSelectedOption(brandOptions, form.brandId)}
				onSelect={values => handleDropdownSelect('brandId', values)}
				isLoading={isBrandsLoading}
			/>
			<DropdownLabel
				isSearchable
				isSingle
				label={t('productModal.unitId')}
				placeholder={t('productModal.unitId')}
				options={unitOptions}
				selectedOptions={getSelectedOption(unitOptions, form.unitId)}
				onSelect={values => handleDropdownSelect('unitId', values)}
				isLoading={isUnitsLoading}
			/>
			<InputLabel
				inputType="text"
				label={t('productModal.taxRate')}
				value={form.taxRate}
				onChange={value => handleFieldChange('taxRate', value)}
			/>
			<DropdownLabel
				isSingle
				label={t('common.status')}
				placeholder={t('common.status')}
				options={statusOptions}
				selectedOptions={getSelectedOption(statusOptions, form.status)}
				onSelect={values =>
					handleFieldChange(
						'status',
						(values[0] as typeof form.status) || 'active',
					)
				}
			/>
			<DropdownLabel
				isSearchable
				isSingle
				label={t('productModal.currency')}
				placeholder={t('productModal.currencyPlaceholder')}
				options={currencyOptions}
				selectedOptions={getSelectedOption(
					currencyOptions,
					form.price.currency,
				)}
				onSelect={handleCurrencySelect}
				isLoading={isCurrenciesLoading}
			/>
		</VStack>
	)

	const renderDetailsStep = () => (
		<VStack spacing={4} align="stretch">
			<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
				<InputLabel
					inputType="text"
					label={t('common.color')}
					value={form.attributes.color}
					onChange={value => handleAttributeChange('color', value)}
				/>
				<InputLabel
					inputType="text"
					label={t('productModal.size')}
					value={form.attributes.size}
					onChange={value => handleAttributeChange('size', value)}
				/>
				<InputLabel
					inputType="text"
					label={t('common.weight')}
					value={form.attributes.weight}
					onChange={value => handleAttributeChange('weight', value)}
				/>
				<InputLabel
					inputType="text"
					label={t('productModal.length')}
					value={form.attributes.length}
					onChange={value => handleAttributeChange('length', value)}
				/>
				<InputLabel
					inputType="text"
					label={t('productModal.width')}
					value={form.attributes.width}
					onChange={value => handleAttributeChange('width', value)}
				/>
				<InputLabel
					inputType="text"
					label={t('productModal.height')}
					value={form.attributes.height}
					onChange={value => handleAttributeChange('height', value)}
				/>
				<InputLabel
					inputType="text"
					label={t('productModal.flavor')}
					value={form.attributes.flavor}
					onChange={value => handleAttributeChange('flavor', value)}
				/>
				<InputLabel
					inputType="text"
					label={t('productModal.expiryDate')}
					value={form.attributes.expiryDate}
					onChange={value => handleAttributeChange('expiryDate', value)}
				/>
			</SimpleGrid>
			<InputLabel
				inputType="text-area"
				label={t('productModal.description')}
				value={form.description}
				onChange={value => handleFieldChange('description', value)}
			/>
		</VStack>
	)

	const renderStepContent = () => {
		switch (step) {
			case 0:
				return renderBasicInfoStep()
			case 1:
				return renderClassificationStep()
			case 2:
				return renderDetailsStep()
			default:
				return null
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
			<ModalOverlay />
			<ModalContent borderRadius="0">
				<ModalHeader sx={styles.header}>
					<VStack sx={styles.headerTitleStepperContainer}>
						<Text sx={styles.headerText}>{t('productModal.newProduct')}</Text>
						<MultiStepper
							numberOfSteps={TOTAL_STEPS}
							currentStep={step}
							setStep={setStep}
						/>
					</VStack>
					<ModalCloseButton sx={styles.modalCloseButton} />
				</ModalHeader>

				<ModalBody sx={styles.body}>
					<Heading sx={styles.bodyHeading} size="sm">
						{stepHeadings[step]}
					</Heading>
					{error ? (
						<Text color="red.500" mb={3}>
							{error}
						</Text>
					) : null}
					{renderStepContent()}
				</ModalBody>

				<ModalFooter sx={styles.footer}>
					<HStack w="100%" justify="space-between" flexWrap="wrap" gap={2}>
						<Button
							variant="ghost"
							onClick={onClose}
							sx={{ ...styles.button, ...styles.secondaryButton }}
						>
							{t('common.cancel')}
						</Button>

						<HStack gap={2}>
							{step > 0 && (
								<Button
									leftIcon={<ChevronLeftIcon />}
									onClick={() => setStep(prev => prev - 1)}
									sx={{ ...styles.button, ...styles.secondaryButton }}
								>
									{t('common.previousStep')}
								</Button>
							)}

							{step < TOTAL_STEPS - 1 && (
								<Button
									rightIcon={<ChevronRightIcon />}
									onClick={() => setStep(prev => prev + 1)}
									sx={styles.button}
								>
									{t('common.nextStep')}
								</Button>
							)}

							<Button
								colorScheme="green"
								onClick={handleSubmit}
								isLoading={isLoading}
								sx={styles.button}
							>
								{t('productModal.saveProduct')}
							</Button>
						</HStack>
					</HStack>
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default AddProductModal
