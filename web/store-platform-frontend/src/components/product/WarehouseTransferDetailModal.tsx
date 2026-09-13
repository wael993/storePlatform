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
	Spinner,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from '@chakra-ui/react'
import dayjs from 'dayjs'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	useGetWarehouseTransferQuery,
	usePatchWarehouseTransferMutation,
} from '../../api/apiStore'
import { Dropdown } from '../dropdown/Dropdown'
import useCustomToast from '../common/CustomToast'
import { useWarehouseScope } from '../../shared/hooks/useWarehouseScope'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { compareLanguage, formatNumber } from '../../shared/utils'

interface WarehouseTransferDetailModalProps {
	referenceId: string | null
	isOpen: boolean
	onClose: () => void
	initialEdit?: boolean
}

const styles = {
	metaRow: {
		justifyContent: 'space-between',
		gap: '1rem',
		width: '100%',
	},
	label: {
		color: '#858585',
		fontSize: '0.875rem',
		fontWeight: 700,
	},
	value: {
		color: '#1E1E1E',
		fontSize: '0.875rem',
		fontWeight: 700,
	},
	secondary: {
		...hoverFocusActiveButtonStyles,
		backgroundColor: '#EAEAEA',
		fontSize: '0.875rem',
	},
	primary: {
		...hoverFocusActiveButtonStyles,
		backgroundColor: '#376288',
		fontSize: '0.875rem',
		color: '#FFFFFF',
	},
	modalCloseButton: { marginTop: '0.9rem', marginRight: '0.4rem' },
} satisfies StylesObject

const WarehouseTransferDetailModal = ({
	referenceId,
	isOpen,
	onClose,
	initialEdit = false,
}: WarehouseTransferDetailModalProps) => {
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const showToast = useCustomToast()
	const { warehouses } = useWarehouseScope()
	const [isEditing, setIsEditing] = useState(initialEdit)
	const [toWarehouseId, setToWarehouseId] = useState('')
	const [quantities, setQuantities] = useState<Record<string, string>>({})
	const hydratedRef = useRef<string | null>(null)
	const {
		data: detail,
		isLoading,
		isError,
	} = useGetWarehouseTransferQuery(referenceId ?? '', {
		skip: !isOpen || !referenceId,
	})
	const [patchTransfer, { isLoading: isSaving }] =
		usePatchWarehouseTransferMutation()

	useEffect(() => {
		if (!isOpen) {
			hydratedRef.current = null
			return
		}
		hydratedRef.current = null
		setIsEditing(initialEdit)
	}, [isOpen, initialEdit, referenceId])

	useEffect(() => {
		if (!detail) return
		if (hydratedRef.current === detail.referenceId) return
		hydratedRef.current = detail.referenceId
		setToWarehouseId(detail.toWarehouseId)
		setQuantities(
			Object.fromEntries(
				detail.items.map(item => [item.productId, String(item.quantity)]),
			),
		)
	}, [detail, isEditing])

	const destinationOptions = useMemo(() => {
		const options = warehouses
			.filter(w => w.warehouseId !== detail?.fromWarehouseId)
			.map(w => ({ value: w.warehouseId, label: w.name }))
		if (
			detail?.toWarehouseId &&
			detail.toWarehouseId !== detail.fromWarehouseId &&
			!options.some(o => o.value === detail.toWarehouseId)
		) {
			options.push({
				value: detail.toWarehouseId,
				label: detail.toWarehouseName || detail.toWarehouseId,
			})
		}
		return options
	}, [
		warehouses,
		detail?.fromWarehouseId,
		detail?.toWarehouseId,
		detail?.toWarehouseName,
	])

	const handleSave = async () => {
		if (!detail) return
		const items = detail.items.map(item => ({
			productId: item.productId,
			quantity: Number.parseInt(quantities[item.productId] ?? '0', 10),
		}))

		if (
			items.some(item => !Number.isInteger(item.quantity) || item.quantity < 1)
		) {
			showToast({
				status: 'error',
				description: t('components.product.warehouseTransfer.error'),
			})
			return
		}

		try {
			await patchTransfer({
				referenceId: detail.referenceId,
				toWarehouseId,
				items,
			}).unwrap()
			showToast({
				status: 'success',
				description: t('components.product.warehouseTransfer.editSuccess'),
			})
			// Keep local form; hydratedRef already matches so exit-edit won't wipe from stale cache.
			setIsEditing(false)
		} catch (error) {
			const err = error as { data?: { message?: string } }
			showToast({
				status: 'error',
				description:
					err.data?.message || t('components.product.warehouseTransfer.error'),
			})
		}
	}

	const handleCancelEdit = () => {
		hydratedRef.current = null
		setIsEditing(false)
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} isCentered size="3xl">
			<ModalOverlay />
			<ModalContent>
				<ModalHeader>
					{t('components.product.warehouseTransfer.detailTitle')}
				</ModalHeader>
				<ModalCloseButton
					sx={styles.modalCloseButton}
					left={isArabic ? '0.4rem' : 'auto'}
					right={isArabic ? 'auto' : '0.4rem'}
					marginRight={0}
				/>
				<ModalBody>
					{isError ? (
						<Text color="red.500" py={8} textAlign="center">
							{t('components.product.warehouseTransfer.detailError')}
						</Text>
					) : isLoading || !detail ? (
						<Flex justify="center" py={8}>
							<Spinner />
						</Flex>
					) : (
						<Flex direction="column" gap={4}>
							<Flex sx={styles.metaRow}>
								<Text sx={styles.label}>
									{t('components.product.warehouseTransfer.fromWarehouse')}
								</Text>
								<Text sx={styles.value}>{detail.fromWarehouseName}</Text>
							</Flex>
							<Flex sx={styles.metaRow} align="flex-start">
								<Text sx={styles.label} pt={isEditing ? 2 : 0}>
									{t('components.product.warehouseTransfer.toWarehouse')}
								</Text>
								{isEditing ? (
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
									/>
								) : (
									<Text sx={styles.value}>{detail.toWarehouseName}</Text>
								)}
							</Flex>
							<Flex sx={styles.metaRow}>
								<Text sx={styles.label}>
									{t('components.product.warehouseTransfer.dateTime')}
								</Text>
								<Text sx={styles.value}>
									{dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm')}
								</Text>
							</Flex>
							<Flex sx={styles.metaRow}>
								<Text sx={styles.label}>
									{t('components.product.warehouseTransfer.user')}
								</Text>
								<Text sx={styles.value}>{detail.createdByName ?? '—'}</Text>
							</Flex>
							<Box overflowX="auto">
								<Table size="sm">
									<Thead>
										<Tr>
											<Th>
												{t('components.product.warehouseTransfer.product')}
											</Th>
											<Th>
												{t('components.product.warehouseTransfer.quantity')}
											</Th>
											<Th>{t('components.product.warehouseTransfer.unit')}</Th>
										</Tr>
									</Thead>
									<Tbody>
										{detail.items.map(item => (
											<Tr key={item.productId}>
												<Td>{item.productName}</Td>
												<Td>
													{isEditing ? (
														<NumberInput
															size="sm"
															min={1}
															value={quantities[item.productId] ?? '1'}
															onChange={value =>
																setQuantities(prev => ({
																	...prev,
																	[item.productId]: value,
																}))
															}
															maxW="6rem"
														>
															<NumberInputField />
														</NumberInput>
													) : (
														(formatNumber(item.quantity) ?? item.quantity)
													)}
												</Td>
												<Td>{item.unitName ?? '—'}</Td>
											</Tr>
										))}
									</Tbody>
								</Table>
							</Box>
						</Flex>
					)}
				</ModalBody>
				<ModalFooter gap={2}>
					{isEditing ? (
						<>
							<Button sx={styles.secondary} onClick={handleCancelEdit}>
								{t('common.cancel')}
							</Button>
							<Button
								sx={styles.primary}
								onClick={() => {
									void handleSave()
								}}
								isLoading={isSaving}
							>
								{t('common.save')}
							</Button>
						</>
					) : (
						<Button sx={styles.secondary} onClick={onClose}>
							{t('common.close')}
						</Button>
					)}
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default WarehouseTransferDetailModal
