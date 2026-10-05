import {
	Modal,
	ModalHeader,
	ModalContent,
	ModalOverlay,
	ModalBody,
	Button,
	ModalFooter,
	Box,
	Text,
	Flex,
	Divider,
	Icon,
	Badge,
	Stack,
	IconButton,
} from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import DropdownLabel from '../DropdownLabel'
import { useTranslation } from 'react-i18next'
import {
	useBulkEditProductsMutation,
	useGetBrandsQuery,
	useGetCategoriesQuery,
	useGetSuppliersQuery,
	useGetUnitsQuery,
} from '../../api/apiStore'
import useCustomToast from '../common/CustomToast'
import { useSee } from '../../shared/hooks/useSee'
import useAllowedActions from '../../shared/hooks/useAllowedActions'
import { SEE } from '../../shared/seeFlags'
import { parseNumberValue } from '../../shared/utils'
import InputLabel from '../common/InputLabel'
import { TrashIcon } from '../../shared/icons/Trash'

const emptyForm = {
	categoryId: '',
	supplierId: '',
	unitId: '',
	brandId: '',
	minQuantity: '',
	discount: '',
}

type BulkEditFormPayload = {
	categoryId?: string
	supplierId?: string
	unitId?: string
	brandId?: string
	minQuantity?: number
	discount?: number
}

interface BulkEditModalProps {
	isOpen: boolean
	onClose: () => void
	selectedProducts: Product[]
	canEditMinQuantity: boolean
	operationalWarehouseId?: string
}

const optionalNumber = (raw: string): number | undefined => {
	const trimmed = raw.trim()
	if (!trimmed) return undefined
	const parsed = Number(parseNumberValue(trimmed))
	return Number.isFinite(parsed) ? parsed : undefined
}

const isInvalidNumberInput = (raw: string): boolean =>
	Boolean(raw.trim()) && optionalNumber(raw) === undefined

const BulkEditModal = ({
	isOpen,
	onClose,
	selectedProducts,
	canEditMinQuantity,
	operationalWarehouseId,
}: BulkEditModalProps) => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const [bulkEdit, { isLoading: isEditing }] = useBulkEditProductsMutation()
	const { canSee } = useSee()
	const { canEditDiscount } = useAllowedActions()
	const canSeeCategories = canSee(SEE.categories)
	const canSeeSupplier = canSee(SEE.supplier)
	const [form, setForm] = useState(emptyForm)
	const [productsList, setProductsList] = useState<Product[]>(selectedProducts)

	useEffect(() => {
		if (!isOpen) setForm(emptyForm)
		setProductsList(selectedProducts)
	}, [isOpen])

	const { data: categories = [], isLoading: isCategoriesLoading } =
		useGetCategoriesQuery(undefined, {
			skip: !isOpen || !canSeeCategories,
		})

	const { data: suppliers = [], isLoading: isSuppliersLoading } =
		useGetSuppliersQuery(
			{},
			{
				skip: !isOpen || !canSeeSupplier,
			},
		)

	const { data: units = [], isLoading: isUnitsLoading } = useGetUnitsQuery(
		{},
		{ skip: !isOpen },
	)

	const { data: brands = [], isLoading: isBrandsLoading } = useGetBrandsQuery(
		undefined,
		{ skip: !isOpen },
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
				value: unit.unitId,
				label: unit.name,
			})),
		[units],
	)

	const brandOptions = useMemo(
		() =>
			brands.map(brand => ({
				value: brand.brandId,
				label: brand.name,
			})),
		[brands],
	)

	const getSelectedOption = (
		options: DropdownOption[],
		value: string,
	): DropdownOption[] => {
		if (!value) return []
		const match = options.find(option => option.value === value)
		return match ? [match] : [{ value, label: value }]
	}

	const handleDropdownSelect = (
		field: 'categoryId' | 'supplierId' | 'unitId' | 'brandId',
		values: string[],
	) => {
		setForm(prev => ({ ...prev, [field]: values[0] ?? '' }))
	}

	const buildPayload = (): BulkEditFormPayload | null => {
		const payload: BulkEditFormPayload = {}
		if (form.categoryId) payload.categoryId = form.categoryId
		if (form.supplierId) payload.supplierId = form.supplierId
		if (form.unitId) payload.unitId = form.unitId
		if (form.brandId) payload.brandId = form.brandId
		if (canEditMinQuantity) {
			const minQuantity = optionalNumber(form.minQuantity)
			if (minQuantity !== undefined) payload.minQuantity = minQuantity
		}
		if (canEditDiscount) {
			const discount = optionalNumber(form.discount)
			if (discount !== undefined) payload.discount = discount
		}
		return Object.keys(payload).length ? payload : null
	}

	const payload = buildPayload()
	const hasInvalidNumbers =
		(canEditMinQuantity && isInvalidNumberInput(form.minQuantity)) ||
		(canEditDiscount && isInvalidNumberInput(form.discount))

	const handleRemoveProduct = (productId: string) => {
		setProductsList(prev =>
			prev.filter(product => product.productId !== productId),
		)
	}

	const handleBulkEdit = async (formPayload: BulkEditFormPayload) => {
		if (!productsList.length || hasInvalidNumbers) return

		const { minQuantity, ...productFields } = formPayload
		if (minQuantity !== undefined && !operationalWarehouseId) {
			showToast({
				status: 'error',
				description: t('components.product.bulkEdit.error'),
			})
			return
		}

		try {
			const result = await bulkEdit({
				productIds: productsList.map(product => product.productId),
				...productFields,
				...(minQuantity !== undefined
					? { minQuantity, warehouseId: operationalWarehouseId }
					: {}),
			}).unwrap()

			if (!result.updated.length) {
				showToast({
					status: 'error',
					description:
						result.blocked[0]?.reason || t('components.product.bulkEdit.error'),
				})
				return
			}

			showToast({
				status: 'success',
				description: t('components.product.bulkEdit.success', {
					count: result.updated.length,
				}),
			})
			onClose()
		} catch (error) {
			const err = error as { data?: { message?: string } }

			showToast({
				status: 'error',
				description:
					err.data?.message || t('components.product.bulkEdit.error'),
			})
		}
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			isCentered
			size="lg"
			scrollBehavior="inside"
		>
			<ModalOverlay bg="blackAlpha.500" />
			<ModalContent borderRadius="xl" overflow="hidden" boxShadow="2xl" mx={4}>
				<ModalHeader
					px={6}
					py={5}
					borderBottom="1px solid"
					borderColor="gray.100"
				>
					<Box>
						<Text fontSize="lg" fontWeight="700" color="gray.800">
							{t('components.product.bulkEdit.title')}
						</Text>
						<Flex align="center" gap={2} mt={1}>
							<Badge
								colorScheme="blue"
								borderRadius="full"
								px={2}
								fontSize="xs"
							>
								{productsList.length}
							</Badge>
							<Text fontSize="sm" color="gray.500" fontWeight="400">
								{t('components.product.bulkEdit.selectedCount')}
							</Text>
						</Flex>
					</Box>
				</ModalHeader>

				<ModalBody px={6} py={6}>
					<Stack spacing={5}>
						<Box>
							<Text fontSize="sm" fontWeight="600" color="gray.700" mb={1}>
								{t('components.product.bulkEdit.sectionTitle')}
							</Text>
							<Text fontSize="xs" color="gray.500">
								{t('components.product.bulkEdit.sectionHint')}
							</Text>
						</Box>

						<Stack spacing={4}>
							{canSeeCategories ? (
								<DropdownLabel
									isSearchable
									isSingle
									label={t('common.category')}
									placeholder={t('common.category')}
									options={categoryOptions}
									selectedOptions={getSelectedOption(
										categoryOptions,
										form.categoryId,
									)}
									onSelect={values =>
										handleDropdownSelect('categoryId', values)
									}
									isLoading={isCategoriesLoading}
								/>
							) : null}

							{canSeeSupplier ? (
								<DropdownLabel
									isSearchable
									isSingle
									label={t('common.supplier')}
									placeholder={t('common.supplier')}
									options={supplierOptions}
									selectedOptions={getSelectedOption(
										supplierOptions,
										form.supplierId,
									)}
									onSelect={values =>
										handleDropdownSelect('supplierId', values)
									}
									isLoading={isSuppliersLoading}
								/>
							) : null}

							<DropdownLabel
								isSearchable
								isSingle
								label={t('common.unit')}
								placeholder={t('common.unit')}
								options={unitOptions}
								selectedOptions={getSelectedOption(unitOptions, form.unitId)}
								onSelect={values => handleDropdownSelect('unitId', values)}
								isLoading={isUnitsLoading}
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
						</Stack>

						{(canEditMinQuantity || canEditDiscount) && (
							<>
								<Divider />
								<Box>
									<Text fontSize="sm" fontWeight="600" color="gray.700" mb={4}>
										{t('components.product.bulkEdit.stockDiscountTitle')}
									</Text>
									<Stack spacing={4}>
										{canEditMinQuantity ? (
											<InputLabel
												label={t('common.stockMinQuantity')}
												inputType="number"
												inputPlaceholder={t('common.stockMinQuantity')}
												value={form.minQuantity}
												onChange={value =>
													setForm(prev => ({ ...prev, minQuantity: value }))
												}
											/>
										) : null}
										{canEditDiscount ? (
											<InputLabel
												label={t('common.discount')}
												inputType="number"
												inputPlaceholder={t('common.discount')}
												value={form.discount}
												onChange={value =>
													setForm(prev => ({ ...prev, discount: value }))
												}
												currency="%"
												hasCurrency
											/>
										) : null}
									</Stack>
								</Box>
							</>
						)}

						<Divider />

						<Box>
							<Flex align="center" justify="space-between" mb={3}>
								<Text fontSize="sm" fontWeight="600" color="gray.700">
									{t('components.product.bulkEdit.selectedList')}
								</Text>
								<Badge
									colorScheme="blue"
									variant="subtle"
									borderRadius="full"
									px={2}
								>
									{productsList.length}
								</Badge>
							</Flex>

							<Box
								border="1px solid"
								borderColor="gray.200"
								borderRadius="lg"
								bg="gray.50"
								maxH="150px"
								overflowY="auto"
								p={3}
							>
								<Stack spacing={2}>
									{productsList.map(product => (
										<Flex
											key={product.productId}
											align="center"
											gap={2}
											justify="space-between"
											bg="gray.50"
											borderRadius="md"
											px={2}
											py={1}
											_hover={{
												bg: '#FFFFFF',
											}}
										>
											<Flex align="center" gap={2} minW={0}>
												<Box
													w="6px"
													h="6px"
													borderRadius="full"
													bg="blue.400"
													flexShrink={0}
												/>

												<Text fontSize="sm" color="gray.700" noOfLines={1}>
													{product.name}
												</Text>
											</Flex>

											<IconButton
												aria-label={`Remove ${product.name}`}
												icon={<Icon as={TrashIcon} />}
												size="xs"
												variant="ghost"
												color="gray.400"
												flexShrink={0}
												onClick={() => handleRemoveProduct(product.productId)}
												_hover={{
													color: 'red.500',
													bg: 'red.50',
												}}
											/>
										</Flex>
									))}
								</Stack>
							</Box>
						</Box>

						<Box
							bg="blue.50"
							border="1px solid"
							borderColor="blue.100"
							borderRadius="lg"
							px={4}
							py={3}
						>
							<Text fontSize="xs" color="blue.700" lineHeight="1.6">
								{t('components.product.bulkEdit.applyHint')}
							</Text>
						</Box>
					</Stack>
				</ModalBody>

				<ModalFooter
					px={6}
					py={4}
					borderTop="1px solid"
					borderColor="gray.100"
					bg="gray.50"
				>
					<Flex w="full" justify="space-between" align="center" gap={3}>
						<Button
							variant="ghost"
							color="gray.600"
							onClick={onClose}
							isDisabled={isEditing}
							_hover={{ bg: 'gray.100' }}
						>
							{t('common.cancel')}
						</Button>
						<Button
							colorScheme="blue"
							onClick={() => {
								if (payload) void handleBulkEdit(payload)
							}}
							isLoading={isEditing}
							isDisabled={
								!payload ||
								isEditing ||
								productsList.length === 0 ||
								hasInvalidNumbers
							}
							px={6}
						>
							{t('common.save')}
						</Button>
					</Flex>
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default BulkEditModal
