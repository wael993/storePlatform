import {
	Flex,
	Grid,
	Heading,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Text,
	useDisclosure,
	VStack,
} from '@chakra-ui/react'
import type { ComponentType } from 'react'
import type { IconProps } from '@chakra-ui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
} from '../api/apiStore'
import { useUser } from '../shared/hooks/useUser'
import { useSee } from '../shared/hooks/useSee'
import { SEE } from '../shared/seeFlags'
import { CashflowIcon } from '../shared/icons/Cashflow'
import { CubeIcon } from '../shared/icons/Cube'
import { GridIcon } from '../shared/icons/Grid'
import { LayerGroupIcon } from '../shared/icons/LayerGroup'
import { PersonIcon } from '../shared/icons/Person'
// import { PriceTagIcon } from '../shared/icons/PriceTag'
import { StarIcon } from '../shared/icons/Star'
import { StoreIcon } from '../shared/icons/Store'
import { TruckIcon } from '../shared/icons/Truck'
import QuickAddFormModal from './modals/AddQuickModal'
import { compareLanguage } from '../shared/utils'
import useCustomToast from './common/CustomToast'

interface AddQuickModalProps {
	isOpen: boolean
	onClose: () => void
}

type FormData = {
	code: string
	value: string
}

type QuickAddCard = {
	type: AddQuickModalType
	labelKey: string
	Icon: ComponentType<IconProps>
}

const QUICK_ADD_CARDS: QuickAddCard[] = [
	{ type: 'customer', labelKey: 'common.customer', Icon: PersonIcon },
	{ type: 'supplier', labelKey: 'common.supplier', Icon: TruckIcon },
	{ type: 'expense', labelKey: 'common.expense', Icon: CashflowIcon },
	// { type: 'currency', labelKey: 'common.currency', Icon: PriceTagIcon },
	{ type: 'unit', labelKey: 'common.unit', Icon: CubeIcon },
	{
		type: 'category',
		labelKey: 'components.filters.category',
		Icon: LayerGroupIcon,
	},
	{ type: 'brand', labelKey: 'components.filters.brand', Icon: StarIcon },
	{ type: 'partner', labelKey: 'common.partner', Icon: PersonIcon },
	{ type: 'shelf', labelKey: 'productModal.shelf', Icon: GridIcon },
	{ type: 'warehouse', labelKey: 'productModal.warehouse', Icon: StoreIcon },
]

const styles = {
	header: {
		borderBottom: '1px solid #EAEAEA',
	},
	title: {
		fontWeight: 700,
		fontSize: '1.25rem',
		color: '#1E1E1E',
	},
	subtitle: {
		fontSize: '0.875rem',
		color: '#929494',
		mt: 1,
	},
	card: {
		bg: '#FFFFFF',
		border: '1px solid #EAEAEA',
		borderRadius: 0,
		p: 4,
		minH: '7.5rem',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 3,
		cursor: 'pointer',
		transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
		_hover: {
			borderColor: '#376288',
			boxShadow: '0 4px 12px rgba(55, 98, 136, 0.12)',
		},
	},
	cardLabel: {
		fontSize: '0.875rem',
		fontWeight: 600,
		color: '#1E1E1E',
		textAlign: 'center' as const,
		noOfLines: 2,
	},
} satisfies StylesObject

const ADD_SEE_FOR: Partial<Record<AddQuickModalType, string>> = {
	customer: SEE.customersAdd,
	supplier: SEE.suppliersAdd,
	category: SEE.categoriesAdd,
	partner: SEE.partnersAdd,
}

const AddQuickNewEntryModal = ({ isOpen, onClose }: AddQuickModalProps) => {
	const { t, i18n } = useTranslation()
	const { isOwnerOrAdmin } = useUser()
	const { canSee } = useSee()
	const { isArabic } = compareLanguage(i18n.language)
	const showToast = useCustomToast()

	const {
		isOpen: isFormOpen,
		onOpen: onFormOpen,
		onClose: onFormClose,
	} = useDisclosure()
	const [modalType, setModalType] = useState<AddQuickModalType>('customer')
	const [formData, setFormData] = useState<FormData>({ code: '', value: '' })
	const [createCustomer, { isLoading: isCustomerLoading }] =
		useCreateCustomerMutation()
	const [createSupplier, { isLoading: isSupplierLoading }] =
		useCreateSupplierMutation()
	const [createExpense, { isLoading: isExpenseLoading }] =
		useCreateExpenseMutation()
	// const [createCurrency, { isLoading: isCurrencyLoading }] =
	// 	useCreateCurrencyMutation()
	const [createUnit, { isLoading: isUnitLoading }] = useCreateUnitMutation()
	const [createCategory, { isLoading: isCategoryLoading }] =
		useCreateCategoryMutation()
	const [createBrand, { isLoading: isBrandLoading }] = useCreateBrandMutation()
	const [createPartner, { isLoading: isPartnerLoading }] =
		useCreatePartnerMutation()
	const [createShelf, { isLoading: isShelfLoading }] = useCreateShelfMutation()
	const [createWarehouse, { isLoading: isWarehouseLoading }] =
		useCreateWarehouseMutation()

	const isQuickAddLoading =
		isCustomerLoading ||
		isSupplierLoading ||
		isExpenseLoading ||
		// isCurrencyLoading ||
		isUnitLoading ||
		isCategoryLoading ||
		isBrandLoading ||
		isPartnerLoading ||
		isShelfLoading ||
		isWarehouseLoading

	const handleInputChange = (field: keyof FormData, value: string) => {
		setFormData(prev => ({ ...prev, [field]: value }))
	}

	const resetForm = () => {
		setFormData({ code: '', value: '' })
		onFormClose()
	}

	const executeAction = async (
		action: () => Promise<unknown>,
		errorMessage: string,
	) => {
		try {
			await action()
			showToast({
				title: t('components.daily.addSuccess'),
				status: 'success',
			})
			resetForm()
		} catch (error) {
			console.error(errorMessage, error)
			showToast({
				title: errorMessage,
				status: 'error',
			})
		}
	}

	const actions: Record<AddQuickModalType, (data: FormData) => Promise<void>> =
		{
			product: async () => undefined,
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
			supplier: async ({ value, code }) => {
				if (!value.trim()) return
				await executeAction(
					() =>
						createSupplier({
							name: value,
							internalCode: (code.trim() || value).toUpperCase(),
						}).unwrap(),
					t('components.daily.errors.addSupplierFailed'),
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

	const handlePickerClose = () => {
		resetForm()
		onClose()
	}

	const openForm = (type: AddQuickModalType) => {
		setModalType(type)
		setFormData({ code: '', value: '' })
		onFormOpen()
	}

	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={handlePickerClose}
				size="4xl"
				scrollBehavior="inside"
				isCentered
			>
				<ModalOverlay bg="blackAlpha.300" backdropFilter="blur(2px)" />
				<ModalContent borderRadius={0} m={4}>
					<ModalHeader sx={styles.header}>
						<VStack alignItems="start">
							<Heading sx={styles.title}>
								{t('components.quickAdd.title')}
							</Heading>
							<Text sx={styles.subtitle}>
								{t('components.quickAdd.subtitle')}
							</Text>
						</VStack>
						<ModalCloseButton
							size="lg"
							sx={{
								left: isArabic ? '0.4rem' : 'auto',
								right: isArabic ? 'auto' : '0.4rem',
								marginRight: 0,
							}}
						/>
					</ModalHeader>
					<ModalBody py={6} px={{ base: 4, md: 8 }} bg="#FAFAFA">
						<Grid
							templateColumns={{
								base: 'repeat(2, 1fr)',
								sm: 'repeat(3, 1fr)',
								md: 'repeat(4, 1fr)',
								lg: 'repeat(5, 1fr)',
							}}
							gap={3}
						>
							{QUICK_ADD_CARDS.filter(({ type }) => {
								const flag = ADD_SEE_FOR[type]
								return !flag || canSee(flag)
							}).map(({ type, labelKey, Icon }) => (
								<Flex
									key={type}
									sx={styles.card}
									onClick={() => openForm(type)}
									role="button"
									tabIndex={0}
									onKeyDown={event => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault()
											openForm(type)
										}
									}}
								>
									<Icon boxSize={8} color="#376288" />
									<Text sx={styles.cardLabel}>{t(labelKey)}</Text>
								</Flex>
							))}
						</Grid>
					</ModalBody>
				</ModalContent>
			</Modal>

			<QuickAddFormModal
				handleInputChange={handleInputChange}
				isOpen={isFormOpen}
				modalType={modalType}
				onClose={resetForm}
				isLoading={isQuickAddLoading}
				setFormData={setFormData}
				inputValue={formData}
				handleQuickAdd={handleQuickAdd}
				userHasAdminRole={
					ADD_SEE_FOR[modalType]
						? canSee(ADD_SEE_FOR[modalType] as string)
						: isOwnerOrAdmin
				}
				showInternalCodeLabel={false}
			/>
		</>
	)
}

export default AddQuickNewEntryModal
