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
	useEditProductMutation,
	useEditInventoryMutation,
	useGetBrandsQuery,
	useGetCategoriesQuery,
	useGetSuppliersQuery,
	useGetUnitsQuery,
	useGetCurrencySettingsQuery,
	useGetWarehousesQuery,
	useGetShelvesQuery,
} from '../api/apiStore'
import { enqueueProductWrite } from '../api/optimisticData'
import { useTranslation } from 'react-i18next'
import InputLabel from '../components/common/InputLabel'
import DatePickerLabel from '../components/common/DatePickerLabel'
import DropdownLabel from '../components/DropdownLabel'
import MultiStepper from '../components/common/MultiStepper'
import { datePickerStyles, hoverFocusActiveButtonStyles } from '../theme/styles'
import { formatDateInputValue } from '../shared/dateUtils'
import { isValid, parse } from 'date-fns'
import { ChevronRightIcon } from '../components/icons/ChevronRight'
import { ChevronLeftIcon } from '../components/icons/ChevronLeftIcon'
import { useSettings } from '../shared/context/SettingsContext'
import {
	buildDisplayCurrencyOptions,
	resolveDefaultDisplayCurrencyId,
} from '../components/SellingInvoice/currencyDisplay'
import { compareLanguage } from '../shared/utils'
import i18n from '../i18n'

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
	warehouseId: '',
	shelfId: '',
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

const toFormString = (value: string | number | null | undefined) =>
	value == null ? '' : String(value)

const parseExpiryDate = (value?: string): Date | undefined => {
	const trimmed = value?.trim()
	if (!trimmed) return undefined

	const dateOnly = trimmed.split('T')[0]
	const isoDate = parse(dateOnly, 'yyyy-MM-dd', new Date())
	if (isValid(isoDate)) return isoDate

	const displayDate = parse(trimmed, 'dd.MM.yyyy', new Date())
	if (isValid(displayDate)) return displayDate

	const fallback = new Date(trimmed)
	return isValid(fallback) ? fallback : undefined
}

const productToForm = (product: Product): typeof INITIAL_FORM => ({
	name: product.name ?? '',
	latinName: product.latinName ?? '',
	barcode: product.barcode ?? '',
	internalCode: product.internalCode ?? '',
	productFactoryCode: product.productFactoryCode ?? '',
	categoryId: product.categoryId ?? '',
	supplierId: product.supplierId ?? '',
	brandId: product.brandId ?? '',
	taxRate: product.taxRate ?? '0',
	unitId: product.unitId ?? '',
	warehouseId: product.inventory?.warehouseId ?? '',
	shelfId: product.inventory?.shelfId ?? '',
	quantity: toFormString(product.inventory?.quantity),
	minQuantity: toFormString(product.inventory?.minQuantity),
	price: {
		purchasePrice: toFormString(product.price?.purchasePrice),
		retailPrice: toFormString(product.price?.retailPrice),
		wholesalePrice: toFormString(product.price?.wholesalePrice),
		semiWholesalePrice: toFormString(product.price?.semiWholesalePrice),
		discount: toFormString(product.price?.discount),
		currency: product.price?.currency ?? '',
	},
	status: product.status,
	attributes: {
		color: product.attributes?.color ?? '',
		size: product.attributes?.size ?? '',
		weight: product.attributes?.weight ?? '',
		length: product.attributes?.length ?? '',
		width: product.attributes?.width ?? '',
		height: product.attributes?.height ?? '',
		flavor: product.attributes?.flavor ?? '',
		expiryDate: (() => {
			const parsed = parseExpiryDate(product.attributes?.expiryDate)
			return parsed ? formatDateInputValue(parsed) : ''
		})(),
	},
	description: product.description ?? '',
})

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
	product?: Product
	initialName?: string
	initialPurchasePrice?: number
	onSuccess?: () => void
	onCreated?: (productId: string) => void
}

const AddProductModal = ({
	isOpen,
	onClose,
	barcode,
	product,
	initialName,
	initialPurchasePrice,
	onSuccess,
	onCreated,
}: AddProductModalProps) => {
	const { t } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const [postNewProduct, { isLoading: isCreating }] = usePostProductMutation()
	const [editProduct, { isLoading: isUpdatingProduct }] =
		useEditProductMutation()
	const [editInventory, { isLoading: isUpdatingInventory }] =
		useEditInventoryMutation()
	const [error, setError] = useState('')
	const [step, setStep] = useState(0)
	const [form, setForm] = useState(INITIAL_FORM)
	const [baseline, setBaseline] = useState<typeof INITIAL_FORM | null>(null)
	const isEdit = Boolean(product)
	const isDirty =
		isEdit &&
		baseline != null &&
		JSON.stringify(form) !== JSON.stringify(baseline)
	const isLoading = isCreating || isUpdatingProduct || isUpdatingInventory

	const { data: categories = [], isLoading: isCategoriesLoading } =
		useGetCategoriesQuery(undefined, { skip: !isOpen })
	const { data: suppliers = [], isLoading: isSuppliersLoading } =
		useGetSuppliersQuery({}, { skip: !isOpen })
	const { data: units = [], isLoading: isUnitsLoading } = useGetUnitsQuery(
		{},
		{ skip: !isOpen },
	)
	const { data: warehouses = [], isLoading: isWarehousesLoading } =
		useGetWarehousesQuery(undefined, { skip: !isOpen })
	const { data: shelves = [], isLoading: isShelvesLoading } =
		useGetShelvesQuery(undefined, { skip: !isOpen })
	const { defaultInvoiceCurrencyId } = useSettings()
	const { data: currencySettings, isLoading: isCurrenciesLoading } =
		useGetCurrencySettingsQuery(undefined, {
			skip: !isOpen,
		})
	const displayCurrencyOptions = useMemo(
		() => buildDisplayCurrencyOptions(currencySettings),
		[currencySettings],
	)

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

	const warehouseOptions = useMemo(
		() =>
			warehouses.map(warehouse => ({
				value: warehouse.warehouseId,
				label: warehouse.name,
			})),
		[warehouses],
	)

	const shelfOptions = useMemo(
		() =>
			shelves.map(shelf => ({
				value: shelf.shelfId,
				label: shelf.name,
			})),
		[shelves],
	)

	const currencyOptions = useMemo(
		() =>
			displayCurrencyOptions.map(option => ({
				value: option.label,
				label: option.name,
			})),
		[displayCurrencyOptions],
	)

	const { data: brands = [], isLoading: isBrandsLoading } = useGetBrandsQuery(
		undefined,
		{ skip: !isOpen },
	)

	const defaultCurrencyCode = useMemo(() => {
		const currencyId = resolveDefaultDisplayCurrencyId(
			displayCurrencyOptions,
			defaultInvoiceCurrencyId,
		)
		const match = displayCurrencyOptions.find(
			option => option.currencyId === currencyId,
		)

		return match?.label ?? ''
	}, [displayCurrencyOptions, defaultInvoiceCurrencyId])

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

	const expiryDateValue = useMemo(
		() => parseExpiryDate(form.attributes.expiryDate),
		[form.attributes.expiryDate],
	)

	useEffect(() => {
		if (!isOpen) {
			setError('')
			setStep(0)
			setForm(INITIAL_FORM)
			setBaseline(null)
		}
	}, [isOpen])

	useEffect(() => {
		if (!isOpen || !product) return

		const next = productToForm(product)
		setForm(next)
		setBaseline(next)
	}, [isOpen, product])

	useEffect(() => {
		if (!isOpen || product) return

		setForm(prev => ({
			...prev,
			name: initialName || prev.name,
			barcode: barcode || prev.barcode,
			price: {
				...prev.price,
				purchasePrice:
					initialPurchasePrice != null
						? String(initialPurchasePrice)
						: prev.price.purchasePrice,
				currency: prev.price.currency || defaultCurrencyCode,
			},
		}))
	}, [
		isOpen,
		product,
		barcode,
		defaultCurrencyCode,
		initialName,
		initialPurchasePrice,
	])

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
		fallbackLabel?: string,
	): DropdownOption[] => {
		if (!value) return []
		const match = options.find(option => option.value === value)
		return match ? [match] : [{ value, label: fallbackLabel || value }]
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
		setBaseline(null)
	}

	const buildProductBody = () => ({
		name: form.name.trim() || form.latinName.trim(),
		latinName: form.latinName.trim() || undefined,
		productFactoryCode: form.productFactoryCode.trim() || undefined,
		barcode: form.barcode.trim(),
		internalCode: form.internalCode.trim() || undefined,
		categoryId: form.categoryId.trim() || undefined,
		brandId: form.brandId.trim() || undefined,
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
			discount: form.price.discount ? Number(form.price.discount) : undefined,
			currency:
				form.price.currency.trim() ||
				defaultCurrencyCode ||
				currencyOptions[0]?.value ||
				'',
		},
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
			expiryDate: (() => {
				const parsed = parseExpiryDate(form.attributes.expiryDate)
				return parsed ? formatDateInputValue(parsed) : undefined
			})(),
		},
		status: form.status,
		description: form.description.trim(),
	})

	const handleSubmit = async () => {
		setError('')

		if (!validateForm()) {
			return
		}

		try {
			const productBody = buildProductBody()

			if (product) {
				await enqueueProductWrite(product.productId, async () => {
					await editProduct({
						id: product.productId,
						body: productBody,
					}).unwrap()

					const inventoryChanged =
						baseline != null &&
						(form.quantity !== baseline.quantity ||
							form.minQuantity !== baseline.minQuantity ||
							form.warehouseId !== baseline.warehouseId ||
							form.shelfId !== baseline.shelfId)

					if (inventoryChanged) {
						await editInventory({
							id: product.productId,
							body: {
								quantity: Number(form.quantity),
								minQuantity: form.minQuantity.trim()
									? Number(form.minQuantity)
									: undefined,
								...(form.warehouseId.trim()
									? { warehouseId: form.warehouseId.trim() }
									: {}),
								...(form.shelfId.trim()
									? { shelfId: form.shelfId.trim() }
									: {}),
							},
						}).unwrap()
					}
				})
			} else {
				const created = await postNewProduct({
					...productBody,
					images: [],
					quantity: Number(form.quantity),
					minQuantity: form.minQuantity.trim()
						? Number(form.minQuantity)
						: undefined,
					...(form.warehouseId.trim()
						? { warehouseId: form.warehouseId.trim() }
						: {}),
					...(form.shelfId.trim() ? { shelfId: form.shelfId.trim() } : {}),
				}).unwrap()
				if (created._id) onCreated?.(created._id)
			}
		} catch (submitError) {
			const err = submitError as { data?: { message?: string } }
			setError(
				err?.data?.message ||
					t(
						product ? 'productModal.updateFailed' : 'productModal.createFailed',
					),
			)
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
				// isReadOnly
				onChange={value => handleFieldChange('barcode', value)}
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
			<DropdownLabel
				isSearchable
				isSingle
				label={t('productModal.warehouse')}
				placeholder={t('productModal.warehouse')}
				options={warehouseOptions}
				selectedOptions={getSelectedOption(
					warehouseOptions,
					form.warehouseId,
					product?.warehouseName,
				)}
				onSelect={values => handleDropdownSelect('warehouseId', values)}
				isLoading={isWarehousesLoading}
			/>
			<DropdownLabel
				isSearchable
				isSingle
				label={t('productModal.shelf')}
				placeholder={t('productModal.shelf')}
				options={shelfOptions}
				selectedOptions={getSelectedOption(
					shelfOptions,
					form.shelfId,
					product?.shelfName,
				)}
				onSelect={values => handleDropdownSelect('shelfId', values)}
				isLoading={isShelvesLoading}
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
				<DatePickerLabel
					label={t('productModal.expiryDate')}
					defaultDate={expiryDateValue}
					onChange={date =>
						handleAttributeChange(
							'expiryDate',
							date ? formatDateInputValue(date) : '',
						)
					}
					allowClear
					usePortal
					styles={datePickerStyles}
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
				<ModalHeader
					sx={{ ...styles.header, justifyContent: isArabic ? 'end' : 'start' }}
				>
					<ModalCloseButton sx={styles.modalCloseButton} />
					<VStack sx={styles.headerTitleStepperContainer}>
						<Text sx={styles.headerText}>
							{t(
								isEdit ? 'productModal.editProduct' : 'productModal.newProduct',
							)}
						</Text>
						<MultiStepper
							numberOfSteps={TOTAL_STEPS}
							currentStep={step}
							setStep={setStep}
						/>
					</VStack>
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
									leftIcon={
										<ChevronLeftIcon
											sx={
												isArabic ? { transform: 'rotate(180deg)' } : undefined
											}
										/>
									}
									onClick={() => setStep(prev => prev - 1)}
									sx={{ ...styles.button, ...styles.secondaryButton }}
								>
									{t('common.previousStep')}
								</Button>
							)}

							{step < TOTAL_STEPS - 1 && (
								<Button
									rightIcon={
										<ChevronRightIcon
											sx={
												isArabic ? { transform: 'rotate(180deg)' } : undefined
											}
										/>
									}
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
								isDisabled={isEdit && !isDirty}
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
