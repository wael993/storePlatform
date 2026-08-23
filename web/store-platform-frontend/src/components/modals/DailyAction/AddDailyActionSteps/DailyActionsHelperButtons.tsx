import { useState } from 'react'
import { Button, SimpleGrid, useDisclosure } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { AsCheckmarkCircleIcon } from '../../../../icons/CheckmarkCircle'
import { hoverFocusActiveButtonStyles } from '../../../../theme/styles'
import {
	useCreateBrandMutation,
	useCreateCategoryMutation,
	// useCreateCurrencyMutation,
	useCreateCustomerMutation,
	useCreateExpenseMutation,
	useCreatePartnerMutation,
	useCreateShelfMutation,
	useCreateSupplierMutation,
	useCreateUnitMutation,
	useCreateWarehouseMutation,
	usePostProductMutation,
} from '../../../../api/apiStore'
import { useUser } from '../../../../shared/hooks/useUser'
import { useSee } from '../../../../shared/hooks/useSee'
import { SEE } from '../../../../shared/seeFlags'
import AddQuickModal from '../../AddQuickModal'

const styles = {
	button: {
		margin: { base: '0 0 1rem 2rem', md: '1rem 1rem 1rem 0rem' },
		backgroundColor: '#376288',
		fontSize: '0.875rem',
		p: { base: '4', md: '1rem 1.5rem' },
		whiteSpace: 'nowrap',
		borderRadius: '0',
		color: '#FFFFFF',
		...hoverFocusActiveButtonStyles,
	},
} satisfies StylesObject

type FormData = {
	code: string
	value: string
}

const BUTTONS: {
	type: AddQuickModalType
	labelKey: string
}[] = [
	{ type: 'product', labelKey: 'components.daily.addProduct' },
	{ type: 'customer', labelKey: 'components.daily.addCustomer' },
	{ type: 'supplier', labelKey: 'components.daily.addSupplier' },
	{ type: 'expense', labelKey: 'components.daily.addExpense' },
	// { type: 'currency', labelKey: 'components.daily.addCurrency' },
	{ type: 'unit', labelKey: 'components.daily.addUnit' },
]

const ADD_SEE_FOR: Partial<Record<AddQuickModalType, string>> = {
	product: SEE.productsAdd,
	customer: SEE.customersAdd,
	supplier: SEE.suppliersAdd,
}

const DailyActionsHelperButtons = () => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const [modalType, setModalType] = useState<AddQuickModalType>('product')
	const [formData, setFormData] = useState<FormData>({
		code: '',
		value: '',
	})

	const { isOwnerOrAdmin } = useUser()
	const { isOpen, onOpen, onClose } = useDisclosure()

	const [postNewProduct, { isLoading: isProductLoading }] =
		usePostProductMutation()
	const [createSupplier, { isLoading: isSupplierLoading }] =
		useCreateSupplierMutation()
	const [createCustomer, { isLoading: isCustomerLoading }] =
		useCreateCustomerMutation()
	const [createExpense, { isLoading: isExpenseLoading }] =
		useCreateExpenseMutation()
	// const [createCurrency, { isLoading: isCurrencyLoading }] =
	// 	useCreateCurrencyMutation()
	const [createUnit, { isLoading: isUnitLoading }] = useCreateUnitMutation()
	const [createPartner, { isLoading: isPartnerLoading }] =
		useCreatePartnerMutation()
	const [createCategory, { isLoading: isCategoryLoading }] =
		useCreateCategoryMutation()
	const [createBrand, { isLoading: isBrandLoading }] = useCreateBrandMutation()
	const [createShelf, { isLoading: isShelfLoading }] = useCreateShelfMutation()
	const [createWarehouse, { isLoading: isWarehouseLoading }] =
		useCreateWarehouseMutation()

	const handleInputChange = (field: keyof FormData, value: string) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}))
	}

	const resetModal = () => {
		setFormData({
			code: '',
			value: '',
		})
		onClose()
	}

	const executeAction = async (
		action: () => Promise<unknown>,
		errorMessage: string,
	) => {
		try {
			await action()
		} catch (error) {
			console.error(errorMessage, error)
		} finally {
			resetModal()
		}
	}

	const isQuickAddLoading =
		isProductLoading ||
		isSupplierLoading ||
		isCustomerLoading ||
		isExpenseLoading ||
		// isCurrencyLoading ||
		isUnitLoading ||
		isPartnerLoading ||
		isCategoryLoading ||
		isBrandLoading ||
		isShelfLoading ||
		isWarehouseLoading

	const actions: Record<AddQuickModalType, (data: FormData) => Promise<void>> =
		{
			product: async ({ value, code }) => {
				if (!value.trim()) return

				const generateRandomBarcode = (): string => {
					return Math.floor(Math.random() * 1000000)
						.toString()
						.padStart(6, '0')
				}
				await executeAction(
					() =>
						postNewProduct({
							name: value,
							internalCode: (code.trim() || value).toUpperCase(),
							barcode: generateRandomBarcode(),
							unitId: 'kg',
							supplierId: '',
							status: 'active',
							quantity: 0,
							price: {
								purchasePrice: 0,
								retailPrice: 0,
								wholesalePrice: 0,
								semiWholesalePrice: 0,
								discount: undefined,
								currency: 'SYP',
							},
						}).unwrap(),
					t('components.daily.errors.addProductFailed'),
				)
			},

			supplier: async ({ value, code }) => {
				if (!value.trim()) return

				await executeAction(
					() =>
						createSupplier({
							name: value,
							internalCode: (code.trim() || value).toUpperCase(),
							// sold: 0,
						}).unwrap(),
					t('components.daily.errors.addSupplierFailed'),
				)
			},

			customer: async ({ value, code }) => {
				if (!value.trim()) return

				await executeAction(
					() =>
						createCustomer({
							name: value,
							internalCode: (code.trim() || value).toUpperCase(),
						}).unwrap(),
					t('components.daily.errors.addCustomerFailed'),
				)
			},

			expense: async ({ value, code }) => {
				if (!value.trim()) return

				await executeAction(
					() =>
						createExpense({
							name: value,
							internalCode: (code.trim() || value).toUpperCase(),
						}).unwrap(),
					t('components.daily.errors.addExpenseFailed'),
				)
			},

			// currency: async ({ value, code }) => {
			// 	const label = value.trim()

			// 	if (!label) return

			// 	await executeAction(
			// 		() =>
			// 			createCurrency({
			// 				name: label,
			// 				internalCode: (code.trim() || label).toUpperCase(),
			// 			}).unwrap(),
			// 		t('components.daily.errors.addCurrencyFailed'),
			// 	)
			// },

			unit: async ({ value, code }) => {
				if (!value.trim()) return

				await executeAction(
					() =>
						createUnit({
							name: value,
							internalCode: (code.trim() || value).toUpperCase(),
						}).unwrap(),
					t('components.daily.errors.addUnitFailed'),
				)
			},

			partner: async ({ value, code }) => {
				if (!value.trim()) return

				await executeAction(
					() =>
						createPartner({
							name: value,
							internalCode: (code.trim() || value).toUpperCase(),
						}).unwrap(),
					t('components.daily.errors.addPartnerFailed'),
				)
			},
			category: async ({ value }) => {
				if (!value.trim()) return

				await executeAction(
					() => createCategory({ name: value.trim() }).unwrap(),
					t('components.quickAdd.errors.addCategoryFailed'),
				)
			},

			brand: async ({ value }) => {
				if (!value.trim()) return

				await executeAction(
					() => createBrand({ name: value.trim() }).unwrap(),
					t('components.quickAdd.errors.addBrandFailed'),
				)
			},

			shelf: async ({ value, code }) => {
				if (!value.trim()) return

				await executeAction(
					() =>
						createShelf({
							name: value.trim(),
							shelfId: (code.trim() || value).toUpperCase(),
						}).unwrap(),
					t('components.quickAdd.errors.addShelfFailed'),
				)
			},

			warehouse: async ({ value, code }) => {
				if (!value.trim()) return

				await executeAction(
					() =>
						createWarehouse({
							name: value.trim(),
							warehouseId: (code.trim() || value).toUpperCase(),
						}).unwrap(),
					t('components.quickAdd.errors.addWarehouseFailed'),
				)
			},
		}

	const handleQuickAdd = async (data: FormData) => {
		await actions[modalType](data)
	}

	return (
		<>
			<SimpleGrid columns={[1, 2, 3]} gap={6} sx={{ marginTop: '2rem' }}>
				{BUTTONS.filter(({ type }) => {
					const flag = ADD_SEE_FOR[type]
					return !flag || canSee(flag)
				}).map(({ type, labelKey }) => (
					<Button
						key={type}
						rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
						size="md"
						variant="primary"
						sx={styles.button}
						onClick={() => {
							setModalType(type)
							onOpen()
						}}
					>
						{t(labelKey)}
					</Button>
				))}
			</SimpleGrid>

			<AddQuickModal
				handleInputChange={handleInputChange}
				isOpen={isOpen}
				modalType={modalType}
				onClose={onClose}
				isLoading={isQuickAddLoading}
				setFormData={setFormData}
				inputValue={formData}
				handleQuickAdd={handleQuickAdd}
				userHasAdminRole={
					ADD_SEE_FOR[modalType]
						? canSee(ADD_SEE_FOR[modalType] as string)
						: isOwnerOrAdmin
				}
			/>
		</>
	)
}

export default DailyActionsHelperButtons
