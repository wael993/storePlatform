import {
	Box,
	Button,
	Flex,
	Icon,
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
import { TrashIcon } from '../../shared/icons/Trash'

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
} satisfies StylesObject

const ProductStockRow = ({
	product,
	warehouseId,
	quantityText,
	onQuantityChange,
	toWarehouseId,
	onSourceQty,
	onRemove,
}: {
	product: Product
	warehouseId: string | null
	quantityText: string
	onQuantityChange: (value: string) => void
	toWarehouseId: string
	onSourceQty: (productId: string, sourceQty: number) => void
	onRemove: (productId: string) => void
}) => {
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const { data: inventoryByWarehouse = [], isSuccess: stockReady } =
		useGetInventoryByProductQuery(product.productId, {
			skip: !product.productId,
		})

	const qtyByWarehouse = useMemo(() => {
		const map = new Map<string, number>()
		for (const row of inventoryByWarehouse) {
			map.set(row.warehouseId, Number(row.quantity ?? 0))
		}
		return map
	}, [inventoryByWarehouse])

	const listQty = Number(product.inventory?.quantity ?? 0)
	// List qty is good enough to confirm; by-product corrects after it settles.
	// note: reserved/availableQuantity is unused; gate on quantity. Upgrade when reservations are written.
	const sourceQty = stockReady
		? warehouseId
			? (qtyByWarehouse.get(warehouseId) ?? 0)
			: 0
		: listQty
	const destinationQty = toWarehouseId
		? (qtyByWarehouse.get(toWarehouseId) ?? 0)
		: 0
	const quantity = parseTransferQty(quantityText)
	const quantityValid = isTransferQtyValid(quantity, sourceQty)
	const oversold =
		stockReady &&
		Number.isInteger(quantity) &&
		quantity >= 1 &&
		quantity > sourceQty

	useLayoutEffect(() => {
		onSourceQty(product.productId, sourceQty)
	}, [onSourceQty, product.productId, sourceQty])

	return (
		<Tr>
			<Td>
				<Icon
					as={TrashIcon}
					color="red.500"
					boxSize={4}
					cursor="pointer"
					onClick={() => onRemove(product.productId)}
				/>
			</Td>
			<Td fontWeight={600}>{product.name}</Td>
			<Td>
				<NumberInput
					size="sm"
					min={1}
					max={Math.max(sourceQty, 1)}
					value={quantityText}
					onChange={onQuantityChange}
					maxW="6rem"
				>
					<NumberInputField />
				</NumberInput>
			</Td>
			<Td isNumeric>
				{formatNumber(sourceQty) ?? sourceQty}
				{quantityValid
					? ` ${isArabic ? '←' : '→'} ${formatNumber(sourceQty - quantity) ?? sourceQty - quantity}`
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
	const [rows, setRows] = useState<Product[]>(products)
	const [toWarehouseId, setToWarehouseId] = useState('')
	const [quantities, setQuantities] = useState<Record<string, string>>({})
	const [sourceQtyById, setSourceQtyById] = useState<Record<string, number>>({})
	const [postTransfer, { isLoading }] = usePostWarehouseTransferMutation()
	const productIdsKey = products.map(p => p.productId).join(',')

	const onSourceQty = useCallback((productId: string, sourceQty: number) => {
		setSourceQtyById(prev =>
			prev[productId] === sourceQty
				? prev
				: { ...prev, [productId]: sourceQty },
		)
	}, [])

	const onRemove = useCallback((productId: string) => {
		setRows(prev => prev.filter(p => p.productId !== productId))
		setQuantities(prev => {
			const next = { ...prev }
			delete next[productId]
			return next
		})
		setSourceQtyById(prev => {
			const next = { ...prev }
			delete next[productId]
			return next
		})
	}, [])

	useEffect(() => {
		if (!isOpen) return
		setRows(products)
		setToWarehouseId('')
		setQuantities(
			Object.fromEntries(products.map(product => [product.productId, '1'])),
		)
		// note: do not clear sourceQtyById here — that runs after the row reports and leaves confirm stuck. key off productIdsKey so a new array ref from parent doesn't reset the form
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

	const items = rows.map(product => ({
		productId: product.productId,
		quantity: parseTransferQty(quantities[product.productId] ?? '1'),
	}))

	const stockOk =
		rows.length > 0 &&
		rows.every(product => {
			const sourceQty = sourceQtyById[product.productId]
			if (sourceQty === undefined) return false
			return isTransferQtyValid(
				parseTransferQty(quantities[product.productId] ?? '1'),
				sourceQty,
			)
		})

	const canConfirm =
		isOperational &&
		Boolean(operationalWarehouseId) &&
		Boolean(toWarehouseId) &&
		rows.length > 0 &&
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
		// <Modal isOpen={isOpen} onClose={onClose} isCentered size="4xl">
		// 	<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />

		// 	<ModalContent
		// 		borderRadius="xl"
		// 		overflow="hidden"
		// 		boxShadow="2xl"
		// 		bg="white"
		// 	>
		// 		{/* Header */}
		// 		<ModalHeader
		// 			px={6}
		// 			py={5}
		// 			borderBottom="1px solid"
		// 			borderColor="gray.100"
		// 			fontSize="lg"
		// 			fontWeight={700}
		// 			color="gray.800"
		// 		>
		// 			{t('components.product.warehouseTransfer.title')}
		// 		</ModalHeader>

		// 		<ModalCloseButton
		// 			size="lg"
		// 			top={4}
		// 			sx={{
		// 				left: isArabic ? '0.4rem' : 'auto',
		// 				right: isArabic ? 'auto' : '0.4rem',
		// 				marginRight: 0,
		// 			}}
		// 			// Keep your existing RTL positioning if required by your styles
		// 		/>

		// 		{/* Body */}
		// 		<ModalBody px={6} py={6}>
		// 			<Flex direction="column" gap={6}>
		// 				{/* Warehouse information */}
		// 				<Box border="1px solid" borderColor="gray.200" borderRadius="lg">
		// 					<Box
		// 						px={4}
		// 						py={3}
		// 						bg="gray.50"
		// 						borderBottom="1px solid"
		// 						borderColor="gray.200"
		// 					>
		// 						<Text fontSize="sm" fontWeight={700} color="gray.700">
		// 							{t('components.product.warehouseTransfer.title')}
		// 						</Text>
		// 					</Box>

		// 					<Flex direction="column" px={4} py={4} gap={4}>
		// 						{/* From warehouse */}
		// 						<Flex align="center" justify="space-between" gap={4}>
		// 							<Text
		// 								fontSize="sm"
		// 								fontWeight={600}
		// 								color="gray.500"
		// 								minW="140px"
		// 							>
		// 								{t('components.product.warehouseTransfer.fromWarehouse')}
		// 							</Text>

		// 							<Box
		// 								flex={1}
		// 								px={3}
		// 								py={2}
		// 								bg="gray.50"
		// 								borderRadius="md"
		// 								border="1px solid"
		// 								borderColor="gray.100"
		// 							>
		// 								<Text fontSize="sm" fontWeight={600} color="gray.800">
		// 									{fromWarehouse?.name ?? operationalWarehouseId ?? '—'}
		// 								</Text>
		// 							</Box>
		// 						</Flex>

		// 						{/* To warehouse */}
		// 						<Flex
		// 							align="flex-start"
		// 							justify="space-between"
		// 							gap={4}
		// 							position="relative"
		// 							zIndex={10}
		// 						>
		// 							<Text
		// 								fontSize="sm"
		// 								fontWeight={600}
		// 								color="gray.500"
		// 								minW="140px"
		// 								pt={2}
		// 							>
		// 								{t('components.product.warehouseTransfer.toWarehouse')}
		// 							</Text>

		// 							<Box flex={1} position="relative" zIndex={20}>
		// 								<Dropdown
		// 									placeholder={t(
		// 										'components.product.warehouseTransfer.selectWarehouse',
		// 									)}
		// 									dropDownOptions={destinationOptions}
		// 									selectedValues={toWarehouseId ? [toWarehouseId] : []}
		// 									onSelect={(values: string[]) =>
		// 										setToWarehouseId(values[0] ?? '')
		// 									}
		// 									isSingle
		// 									showClearOptions={false}
		// 									disabled={destinationOptions.length === 0}
		// 								/>
		// 							</Box>
		// 						</Flex>
		// 					</Flex>
		// 				</Box>

		// 				{/* Products */}
		// 				<Box>
		// 					<Flex align="center" justify="space-between" mb={3}>
		// 						<Box>
		// 							<Text fontSize="md" fontWeight={700} color="gray.800">
		// 								{t('components.product.warehouseTransfer.product')}
		// 							</Text>

		// 							<Text fontSize="xs" color="gray.500" mt={0.5}>
		// 								{rows.length} {rows.length === 1 ? 'item' : 'items'}
		// 							</Text>
		// 						</Box>
		// 					</Flex>

		// 					<Box
		// 						border="1px solid"
		// 						borderColor="gray.200"
		// 						borderRadius="lg"
		// 						zIndex={10}
		// 					>
		// 						<Table size="sm">
		// 							<Thead bg="gray.50">
		// 								<Tr>
		// 									<Th borderColor="gray.200" py={3} w="40px" />
		// 									<Th
		// 										borderColor="gray.200"
		// 										py={3}
		// 										fontSize="xs"
		// 										color="gray.500"
		// 										fontWeight={700}
		// 										textTransform="uppercase"
		// 										letterSpacing="0.04em"
		// 									>
		// 										{t('components.product.warehouseTransfer.product')}
		// 									</Th>
		// 									<Th
		// 										borderColor="gray.200"
		// 										py={3}
		// 										fontSize="xs"
		// 										color="gray.500"
		// 										fontWeight={700}
		// 										textTransform="uppercase"
		// 										letterSpacing="0.04em"
		// 									>
		// 										{t('components.product.warehouseTransfer.quantity')}
		// 									</Th>
		// 									<Th
		// 										isNumeric
		// 										borderColor="gray.200"
		// 										py={3}
		// 										fontSize="xs"
		// 										color="gray.500"
		// 										fontWeight={700}
		// 										textTransform="uppercase"
		// 										letterSpacing="0.04em"
		// 									>
		// 										{t('components.product.warehouseTransfer.sourceStock')}
		// 									</Th>
		// 									<Th
		// 										isNumeric
		// 										borderColor="gray.200"
		// 										py={3}
		// 										fontSize="xs"
		// 										color="gray.500"
		// 										fontWeight={700}
		// 										textTransform="uppercase"
		// 										letterSpacing="0.04em"
		// 									>
		// 										{t(
		// 											'components.product.warehouseTransfer.destinationStock',
		// 										)}
		// 									</Th>
		// 									<Th borderColor="gray.200" py={3} w="50px" />
		// 								</Tr>
		// 							</Thead>

		// 							<Tbody>
		// 								{rows.map(product => (
		// 									<ProductStockRow
		// 										key={product.productId}
		// 										product={product}
		// 										warehouseId={operationalWarehouseId}
		// 										quantityText={quantities[product.productId] ?? '1'}
		// 										onQuantityChange={value =>
		// 											setQuantities(prev => ({
		// 												...prev,
		// 												[product.productId]: value,
		// 											}))
		// 										}
		// 										toWarehouseId={toWarehouseId}
		// 										onSourceQty={onSourceQty}
		// 										onRemove={onRemove}
		// 									/>
		// 								))}
		// 							</Tbody>
		// 						</Table>
		// 					</Box>
		// 				</Box>

		// 				{/* Warning */}
		// 				{!isOperational ? (
		// 					<Box
		// 						display="flex"
		// 						alignItems="flex-start"
		// 						gap={3}
		// 						px={4}
		// 						py={3}
		// 						borderRadius="lg"
		// 						bg="red.50"
		// 						border="1px solid"
		// 						borderColor="red.100"
		// 					>
		// 						<Box
		// 							mt="2px"
		// 							w="7px"
		// 							h="7px"
		// 							borderRadius="full"
		// 							bg="red.500"
		// 							flexShrink={0}
		// 						/>

		// 						<Text color="red.700" fontSize="sm" fontWeight={600}>
		// 							{t('components.topBar.warehouseScopePostingBlocked')}
		// 						</Text>
		// 					</Box>
		// 				) : null}
		// 			</Flex>
		// 		</ModalBody>

		// 		{/* Footer */}
		// 		<ModalFooter
		// 			px={6}
		// 			py={4}
		// 			bg="gray.50"
		// 			borderTop="1px solid"
		// 			borderColor="gray.100"
		// 			gap={3}
		// 		>
		// 			<Button
		// 				variant="ghost"
		// 				color="gray.600"
		// 				fontWeight={600}
		// 				px={5}
		// 				onClick={onClose}
		// 				_hover={{
		// 					bg: 'gray.100',
		// 					color: 'gray.800',
		// 				}}
		// 			>
		// 				{t('common.cancel')}
		// 			</Button>

		// 			<Button
		// 				sx={{
		// 					...styles.confirm,
		// 					color: '#FFFFFF',
		// 				}}
		// 				px={6}
		// 				fontWeight={600}
		// 				borderRadius="md"
		// 				boxShadow="sm"
		// 				onClick={() => {
		// 					void handleConfirm()
		// 				}}
		// 				isLoading={isLoading}
		// 				isDisabled={!canConfirm}
		// 				_hover={{
		// 					opacity: 0.9,
		// 					transform: 'translateY(-1px)',
		// 					boxShadow: 'md',
		// 				}}
		// 				_active={{
		// 					transform: 'translateY(0)',
		// 				}}
		// 			>
		// 				{t('components.product.warehouseTransfer.confirm')}
		// 			</Button>
		// 		</ModalFooter>
		// 	</ModalContent>
		// </Modal>

		<Modal
			isOpen={isOpen}
			onClose={onClose}
			isCentered
			size={{ base: 'full', md: '4xl' }}
		>
			<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />

			<ModalContent
				borderRadius={{ base: 0, md: 'xl' }}
				overflow="hidden"
				boxShadow="2xl"
				bg="white"
				maxW={{ base: '100%', md: '56rem' }}
				w={{ base: '100%', md: 'calc(100% - 2rem)' }}
				maxH={{ base: '100dvh', md: '90vh' }}
				my={{ base: 0, md: 4 }}
			>
				{/* Header */}
				<ModalHeader
					px={{ base: 4, md: 6 }}
					py={{ base: 4, md: 5 }}
					pr={{ base: 12, md: 14 }}
					borderBottom="1px solid"
					borderColor="gray.100"
					fontSize={{ base: 'md', md: 'lg' }}
					fontWeight={700}
					color="gray.800"
				>
					{t('components.product.warehouseTransfer.title')}
				</ModalHeader>

				<ModalCloseButton
					size="lg"
					top={{ base: 3, md: 4 }}
					sx={{
						left: isArabic ? '0.4rem' : 'auto',
						right: isArabic ? 'auto' : '0.4rem',
						marginRight: 0,
					}}
				/>

				{/* Body */}
				<ModalBody
					px={{ base: 4, md: 6 }}
					py={{ base: 4, md: 6 }}
					overflowY="auto"
					overflowX="hidden"
				>
					<Flex direction="column" gap={{ base: 4, md: 6 }}>
						{/* Warehouse information */}
						<Box
							border="1px solid"
							borderColor="gray.200"
							borderRadius="lg"
							position="relative"
							zIndex={20}
						>
							<Box
								px={{ base: 3, md: 4 }}
								py={3}
								bg="gray.50"
								borderBottom="1px solid"
								borderColor="gray.200"
							>
								<Text fontSize="sm" fontWeight={700} color="gray.700">
									{t('components.product.warehouseTransfer.title')}
								</Text>
							</Box>

							<Flex
								direction="column"
								px={{ base: 3, md: 4 }}
								py={{ base: 3, md: 4 }}
								gap={{ base: 4, md: 4 }}
							>
								{/* From warehouse */}
								<Flex
									align={{ base: 'flex-start', md: 'center' }}
									direction={{ base: 'column', md: 'row' }}
									justify="space-between"
									gap={{ base: 2, md: 4 }}
								>
									<Text
										fontSize="sm"
										fontWeight={600}
										color="gray.500"
										minW={{ base: 'auto', md: '140px' }}
									>
										{t('components.product.warehouseTransfer.fromWarehouse')}
									</Text>

									<Box
										flex={1}
										w="full"
										px={3}
										py={2}
										bg="gray.50"
										borderRadius="md"
										border="1px solid"
										borderColor="gray.100"
									>
										<Text
											fontSize="sm"
											fontWeight={600}
											color="gray.800"
											noOfLines={1}
										>
											{fromWarehouse?.name ?? operationalWarehouseId ?? '—'}
										</Text>
									</Box>
								</Flex>

								{/* To warehouse */}
								<Flex
									align={{ base: 'stretch', md: 'flex-start' }}
									direction={{ base: 'column', md: 'row' }}
									justify="space-between"
									gap={{ base: 2, md: 4 }}
									position="relative"
									zIndex={30}
								>
									<Text
										fontSize="sm"
										fontWeight={600}
										color="gray.500"
										minW={{ base: 'auto', md: '140px' }}
										pt={{ base: 0, md: 2 }}
									>
										{t('components.product.warehouseTransfer.toWarehouse')}
									</Text>

									<Box flex={1} w="full" position="relative" zIndex={40}>
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
							</Flex>
						</Box>

						{/* Products */}
						<Box minW={0}>
							<Flex align="center" justify="space-between" mb={3}>
								<Box>
									<Text fontSize="md" fontWeight={700} color="gray.800">
										{t('components.product.warehouseTransfer.product')}
									</Text>

									<Text fontSize="xs" color="gray.500" mt={0.5}>
										{rows.length} {rows.length === 1 ? 'item' : 'items'}
									</Text>
								</Box>
							</Flex>

							{/* Table scroll container */}
							<Box
								border="1px solid"
								borderColor="gray.200"
								borderRadius="lg"
								overflowX="auto"
								overflowY="hidden"
								// WebkitOverflowScrolling="touch"
								maxW="100%"
							>
								<Table size="sm" minW={{ base: '720px', md: 'auto' }}>
									<Thead bg="gray.50">
										<Tr>
											<Th borderColor="gray.200" py={3} w="40px" />

											<Th
												borderColor="gray.200"
												py={3}
												fontSize="xs"
												color="gray.500"
												fontWeight={700}
												textTransform="uppercase"
												letterSpacing="0.04em"
											>
												{t('components.product.warehouseTransfer.product')}
											</Th>

											<Th
												borderColor="gray.200"
												py={3}
												fontSize="xs"
												color="gray.500"
												fontWeight={700}
												textTransform="uppercase"
												letterSpacing="0.04em"
											>
												{t('components.product.warehouseTransfer.quantity')}
											</Th>

											<Th
												isNumeric
												borderColor="gray.200"
												py={3}
												fontSize="xs"
												color="gray.500"
												fontWeight={700}
												textTransform="uppercase"
												letterSpacing="0.04em"
											>
												{t('components.product.warehouseTransfer.sourceStock')}
											</Th>

											<Th
												isNumeric
												borderColor="gray.200"
												py={3}
												fontSize="xs"
												color="gray.500"
												fontWeight={700}
												textTransform="uppercase"
												letterSpacing="0.04em"
											>
												{t(
													'components.product.warehouseTransfer.destinationStock',
												)}
											</Th>

											<Th borderColor="gray.200" py={3} w="50px" />
										</Tr>
									</Thead>

									<Tbody>
										{rows.map(product => (
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
												onSourceQty={onSourceQty}
												onRemove={onRemove}
											/>
										))}
									</Tbody>
								</Table>
							</Box>
						</Box>

						{/* Warning */}
						{!isOperational ? (
							<Box
								display="flex"
								alignItems="flex-start"
								gap={3}
								px={{ base: 3, md: 4 }}
								py={3}
								borderRadius="lg"
								bg="red.50"
								border="1px solid"
								borderColor="red.100"
							>
								<Box
									mt="2px"
									w="7px"
									h="7px"
									borderRadius="full"
									bg="red.500"
									flexShrink={0}
								/>

								<Text color="red.700" fontSize="sm" fontWeight={600}>
									{t('components.topBar.warehouseScopePostingBlocked')}
								</Text>
							</Box>
						) : null}
					</Flex>
				</ModalBody>

				{/* Footer */}
				<ModalFooter
					px={{ base: 4, md: 6 }}
					py={{ base: 3, md: 4 }}
					bg="gray.50"
					borderTop="1px solid"
					borderColor="gray.100"
					gap={3}
					flexDirection={{ base: 'column-reverse', sm: 'row' }}
					alignItems={{ base: 'stretch', sm: 'center' }}
				>
					<Button
						variant="ghost"
						color="gray.600"
						fontWeight={600}
						px={5}
						w={{ base: 'full', sm: 'auto' }}
						onClick={onClose}
						_hover={{
							bg: 'gray.100',
							color: 'gray.800',
						}}
					>
						{t('common.cancel')}
					</Button>

					<Button
						sx={{
							...styles.confirm,
							color: '#FFFFFF',
						}}
						px={6}
						w={{ base: 'full', sm: 'auto' }}
						fontWeight={600}
						borderRadius="md"
						boxShadow="sm"
						onClick={() => {
							void handleConfirm()
						}}
						isLoading={isLoading}
						isDisabled={!canConfirm}
						_hover={{
							opacity: 0.9,
							transform: 'translateY(-1px)',
							boxShadow: 'md',
						}}
						_active={{
							transform: 'translateY(0)',
						}}
					>
						{t('components.product.warehouseTransfer.confirm')}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default WarehouseTransferModal
