import {
	Box,
	Button,
	Flex,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	NumberInput,
	NumberInputField,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from '@chakra-ui/react'
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
	useGetInventoryByProductQuery,
	usePostWarehouseTransferMutation,
} from '../../api/apiStore'
import { Dropdown } from '../dropdown/Dropdown'
import useCustomToast from '../common/CustomToast'
import { useWarehouseScope } from '../../shared/hooks/useWarehouseScope'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { compareLanguage, formatNumber } from '../../shared/utils'
import { isTransferQtyValid, parseTransferQty } from './warehouseTransferQty'

interface WarehouseTransferModalProps {
	products: Product[]
	isOpen: boolean
	onClose: () => void
}

const styles = {
	row: {
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: '1rem',
		width: '100%',
	},
	label: {
		color: '#858585',
		fontSize: '0.875rem',
		fontWeight: 700,
		minW: '8rem',
	},
	value: {
		color: '#1E1E1E',
		fontSize: '0.875rem',
		fontWeight: 700,
	},
	confirm: {
		...hoverFocusActiveButtonStyles,
		backgroundColor: '#376288',
		fontSize: '0.875rem',
	},
	cancel: {
		...hoverFocusActiveButtonStyles,
		backgroundColor: '#EAEAEA',
		fontSize: '0.875rem',
	},
	modalCloseButton: { marginTop: '0.9rem', marginRight: '0.4rem' },
} satisfies StylesObject

const ProductStockRow = ({
	product,
	warehouseId,
	quantityText,
	onQuantityChange,
	toWarehouseId,
	onAvailable,
}: {
	product: Product
	warehouseId: string | null
	quantityText: string
	onQuantityChange: (value: string) => void
	toWarehouseId: string
	onAvailable: (productId: string, available: number) => void
}) => {
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const { data: inventoryByWarehouse = [], isSuccess: stockReady } =
		useGetInventoryByProductQuery(product.productId, {
			skip: !product.productId,
		})

	const qtyByWarehouse = useMemo(() => {
		const map = new Map<string, { quantity: number; available: number }>()
		for (const row of inventoryByWarehouse) {
			const quantity = Number(row.quantity ?? 0)
			map.set(row.warehouseId, {
				quantity,
				available: Number(row.availableQuantity ?? quantity),
			})
		}
		return map
	}, [inventoryByWarehouse])

	const sourceRow = warehouseId ? qtyByWarehouse.get(warehouseId) : undefined
	const listAvailable = Number(
		product.inventory?.availableQuantity ?? product.inventory?.quantity ?? 0,
	)
	// List stock is good enough to confirm; by-product corrects after it settles.
	const sourceAvailable = stockReady
		? (sourceRow?.available ?? 0)
		: listAvailable
	const destinationQty = toWarehouseId
		? (qtyByWarehouse.get(toWarehouseId)?.quantity ?? 0)
		: 0
	const quantity = parseTransferQty(quantityText)
	const quantityValid = isTransferQtyValid(quantity, sourceAvailable)
	const oversold =
		stockReady &&
		Number.isInteger(quantity) &&
		quantity >= 1 &&
		quantity > sourceAvailable

	useLayoutEffect(() => {
		onAvailable(product.productId, sourceAvailable)
	}, [onAvailable, product.productId, sourceAvailable])

	return (
		<Tr>
			<Td fontWeight={600}>{product.name}</Td>
			<Td>
				<NumberInput
					size="sm"
					min={1}
					max={Math.max(sourceAvailable, 1)}
					value={quantityText}
					onChange={onQuantityChange}
					maxW="6rem"
				>
					<NumberInputField />
				</NumberInput>
			</Td>
			<Td isNumeric>
				{formatNumber(sourceAvailable) ?? sourceAvailable}
				{quantityValid
					? ` ${isArabic ? '←' : '→'} ${formatNumber(sourceAvailable - quantity) ?? sourceAvailable - quantity}`
					: ''}
			</Td>
			<Td isNumeric>
				{toWarehouseId
					? `${formatNumber(destinationQty) ?? destinationQty}${
							quantityValid
								? ` ${isArabic ? '←' : '→'} ${formatNumber(destinationQty + quantity) ?? destinationQty + quantity}`
								: ''
						}`
					: '—'}
			</Td>
			<Td>
				{oversold ? (
					<Text color="red.500" fontSize="xs" fontWeight={600}>
						{t('components.product.warehouseTransfer.insufficientStock')}
					</Text>
				) : null}
			</Td>
		</Tr>
	)
}

const WarehouseTransferModal = ({
	products,
	isOpen,
	onClose,
}: WarehouseTransferModalProps) => {
	const showToast = useCustomToast()
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const { warehouses, operationalWarehouseId, isOperational } =
		useWarehouseScope()
	const [toWarehouseId, setToWarehouseId] = useState('')
	const [quantities, setQuantities] = useState<Record<string, string>>({})
	const [availableById, setAvailableById] = useState<Record<string, number>>({})
	const [postTransfer, { isLoading }] = usePostWarehouseTransferMutation()
	const productIdsKey = products.map(p => p.productId).join(',')

	const onAvailable = useCallback((productId: string, available: number) => {
		setAvailableById(prev =>
			prev[productId] === available
				? prev
				: { ...prev, [productId]: available },
		)
	}, [])

	useEffect(() => {
		if (!isOpen) return
		setToWarehouseId('')
		setQuantities(
			Object.fromEntries(products.map(product => [product.productId, '1'])),
		)
		// note: do not clear availableById here — that runs after the row reports and leaves confirm stuck. key off productIdsKey so a new array ref from parent doesn't reset the form
	}, [isOpen, productIdsKey])

	const fromWarehouse = warehouses.find(
		w => w.warehouseId === operationalWarehouseId,
	)
	const destinationOptions = useMemo(
		() =>
			warehouses
				.filter(w => w.warehouseId !== operationalWarehouseId)
				.map(w => ({
					value: w.warehouseId,
					label: w.name,
				})),
		[warehouses, operationalWarehouseId],
	)

	const items = products.map(product => ({
		productId: product.productId,
		quantity: parseTransferQty(quantities[product.productId] ?? '1'),
	}))

	const stockOk =
		products.length > 0 &&
		products.every(product => {
			const available = availableById[product.productId]
			if (available === undefined) return false
			return isTransferQtyValid(
				parseTransferQty(quantities[product.productId] ?? '1'),
				available,
			)
		})

	const canConfirm =
		isOperational &&
		Boolean(operationalWarehouseId) &&
		Boolean(toWarehouseId) &&
		products.length > 0 &&
		stockOk

	const handleConfirm = async () => {
		if (!operationalWarehouseId || !canConfirm) return

		try {
			await postTransfer({
				fromWarehouseId: operationalWarehouseId,
				toWarehouseId,
				items,
			}).unwrap()

			showToast({
				status: 'success',
				description: t('components.product.warehouseTransfer.success'),
			})
			onClose()
		} catch (error) {
			const err = error as { data?: { message?: string } }
			showToast({
				status: 'error',
				description:
					err.data?.message || t('components.product.warehouseTransfer.error'),
			})
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} isCentered size="4xl">
			<ModalOverlay />
			<ModalContent>
				<ModalHeader>
					{t('components.product.warehouseTransfer.title')}
				</ModalHeader>
				<ModalCloseButton
					size="lg"
					sx={{
						...styles.modalCloseButton,
						left: isArabic ? '0.4rem' : 'auto',
						right: isArabic ? 'auto' : '0.4rem',
						marginRight: 0,
					}}
				/>
				<ModalBody>
					<Flex direction="column" gap={4}>
						<Flex sx={styles.row}>
							<Text sx={styles.label}>
								{t('components.product.warehouseTransfer.fromWarehouse')}
							</Text>
							<Text sx={styles.value}>
								{fromWarehouse?.name ?? operationalWarehouseId ?? '—'}
							</Text>
						</Flex>
						<Flex sx={styles.row} align="flex-start">
							<Text sx={styles.label} pt={2}>
								{t('components.product.warehouseTransfer.toWarehouse')}
							</Text>
							<Box sx={styles.value}>
								<Dropdown
									placeholder={t(
										'components.product.warehouseTransfer.selectWarehouse',
									)}
									dropDownOptions={destinationOptions}
									selectedValues={toWarehouseId ? [toWarehouseId] : []}
									onSelect={(values: string[]) =>
										setToWarehouseId(values[0] ?? '')
									}
									isSingle
									showClearOptions={false}
									disabled={destinationOptions.length === 0}
								/>
							</Box>
						</Flex>
						<Box overflowX="auto">
							<Table size="sm">
								<Thead>
									<Tr>
										<Th>{t('components.product.warehouseTransfer.product')}</Th>
										<Th>
											{t('components.product.warehouseTransfer.quantity')}
										</Th>
										<Th isNumeric>
											{t('components.product.warehouseTransfer.sourceStock')}
										</Th>
										<Th isNumeric>
											{t(
												'components.product.warehouseTransfer.destinationStock',
											)}
										</Th>
										<Th />
									</Tr>
								</Thead>
								<Tbody>
									{products.map(product => (
										<ProductStockRow
											key={product.productId}
											product={product}
											warehouseId={operationalWarehouseId}
											quantityText={quantities[product.productId] ?? '1'}
											onQuantityChange={value =>
												setQuantities(prev => ({
													...prev,
													[product.productId]: value,
												}))
											}
											toWarehouseId={toWarehouseId}
											onAvailable={onAvailable}
										/>
									))}
								</Tbody>
							</Table>
						</Box>
						{!isOperational ? (
							<Text color="red.500" fontSize="sm" fontWeight={600}>
								{t('components.topBar.warehouseScopePostingBlocked')}
							</Text>
						) : null}
					</Flex>
				</ModalBody>
				<ModalFooter gap={2}>
					<Button sx={styles.cancel} onClick={onClose}>
						{t('common.cancel')}
					</Button>
					<Button
						sx={{ ...styles.confirm, color: '#FFFFFF' }}
						onClick={() => {
							void handleConfirm()
						}}
						isLoading={isLoading}
						isDisabled={!canConfirm}
					>
						{t('components.product.warehouseTransfer.confirm')}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default WarehouseTransferModal
