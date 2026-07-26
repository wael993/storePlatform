import {
	Box,
	Flex,
	IconButton,
	Image,
	// NumberInput,
	// NumberInputField,
	// Select,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from '@chakra-ui/react'
import { useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PAGE_COLORS } from './constants'
import {
	calculateLineItemTotal,
	getLineDiscountAmount,
	unitPriceFromLineTotalWithDiscount,
} from './invoiceCalculations'
import type { SellingInvoiceLineItem } from './types'
import { AsTrashIcon } from '../../icons/Trash'
import { AsProductIcon } from '../../icons/Product'
import TextLabel from '../common/TextLabel'
import CurrencyAmountTooltip from './CurrencyAmountTooltip'
import EditableDiscountField from './EditableDiscountField'
import EditableNumberField from './EditableNumberField'
import {
	roundPrimaryAmount,
	type DisplayCurrencyOption,
} from './currencyDisplay'

interface InvoiceLineItemsTableProps {
	lineItems: SellingInvoiceLineItem[]
	onUpdateItem: (id: string, updates: Partial<SellingInvoiceLineItem>) => void
	onRemoveItem: (id: string) => void
	formatAmount: (amount: number) => string
	displayCurrencyId: string | null
	currencyOptions: DisplayCurrencyOption[]
	isReadOnly?: boolean
	invoiceKind?: 'selling' | 'buying'
}

const ProductThumbnail = ({
	name,
	imageUrl,
}: {
	name: string
	imageUrl?: string
}) => {
	if (imageUrl) {
		return (
			<Image
				src={imageUrl}
				alt={name}
				boxSize="2.5rem"
				borderRadius="md"
				objectFit="cover"
				flexShrink={0}
			/>
		)
	}

	return (
		<Flex
			boxSize="2.5rem"
			borderRadius="md"
			bg="gray.100"
			align="center"
			justify="center"
			flexShrink={0}
			color={PAGE_COLORS.muted}
		>
			<AsProductIcon fill="none" color={PAGE_COLORS.muted} boxSize={4} />
		</Flex>
	)
}

const InvoiceLineItemsTable = ({
	lineItems,
	onUpdateItem,
	onRemoveItem,
	formatAmount,
	displayCurrencyId,
	currencyOptions,
	isReadOnly = false,
	invoiceKind = 'selling',
}: InvoiceLineItemsTableProps) => {
	const { t } = useTranslation()
	const editStartRefs = useRef(new Map<string, () => void>())

	// Newest line items are appended last; show newest first in the table.
	const displayLineItems = useMemo(() => [...lineItems].reverse(), [lineItems])

	type LineItemField = 'quantity' | 'unitPrice' | 'discount' | 'total'

	const lineItemFieldId = (itemId: string, field: LineItemField) =>
		`${itemId}-${field}`

	const registerEditStart = useCallback(
		(fieldId: string, start: (() => void) | null) => {
			if (start) {
				editStartRefs.current.set(fieldId, start)
				return
			}
			editStartRefs.current.delete(fieldId)
		},
		[],
	)

	const focusNextField = useCallback(
		(currentIndex: number, field: LineItemField) => {
			const nextItem = displayLineItems[currentIndex + 1]
			if (!nextItem) return

			const nextFieldId = lineItemFieldId(nextItem.id, field)
			// ponytail: rAF defer — let current input blur/unmount before opening next
			requestAnimationFrame(() => {
				editStartRefs.current.get(nextFieldId)?.()
			})
		},
		[displayLineItems],
	)

	const handleQuantityEdit = (
		item: SellingInvoiceLineItem,
		quantity: number,
	) => {
		onUpdateItem(item.id, { quantity })
	}

	const handleUnitPriceEdit = (
		item: SellingInvoiceLineItem,
		unitPrice: number,
	) => {
		onUpdateItem(item.id, {
			unitPrice: roundPrimaryAmount(unitPrice),
		})
	}

	const handleDiscountEdit = (
		item: SellingInvoiceLineItem,
		discount: number,
		discountIsPercent: boolean,
	) => {
		onUpdateItem(item.id, { discount, discountIsPercent })
	}

	const handleTotalEdit = (item: SellingInvoiceLineItem, total: number) => {
		onUpdateItem(item.id, {
			unitPrice: unitPriceFromLineTotalWithDiscount(
				total,
				item.quantity,
				item.discount,
				item.discountIsPercent,
			),
		})
	}

	if (lineItems.length === 0) {
		return (
			<Box
				border="1px dashed"
				borderColor={PAGE_COLORS.border}
				borderRadius="lg"
				py={10}
				textAlign="center"
			>
				<Text color={PAGE_COLORS.muted} fontSize="sm">
					{t('components.sellingInvoices.drawer.noItems')}
				</Text>
			</Box>
		)
	}

	return (
		<Box
			// overflowX="auto"
			border="1px solid"
			borderColor={PAGE_COLORS.border}
			borderRadius="lg"
		>
			<Table variant="simple" size="sm">
				<Thead bg="gray.50">
					<Tr textAlign="right">
						<Th>#</Th>
						<Th minW="12rem">
							{t('components.sellingInvoices.drawer.columns.product')}
						</Th>
						{/* <Th>{t('components.sellingInvoices.drawer.columns.barcode')}</Th> */}
						<Th>{t('components.sellingInvoices.drawer.columns.qty')}</Th>
						<Th>{t('components.sellingInvoices.drawer.columns.price')}</Th>
						<Th>{t('components.sellingInvoices.drawer.columns.discount')}</Th>
						<Th>{t('components.sellingInvoices.drawer.columns.total')}</Th>
						{!isReadOnly && <Th w="2.5rem" />}
					</Tr>
				</Thead>
				<Tbody>
					{displayLineItems.map((item, index) => (
						<Tr key={item.id}>
							<Td color={PAGE_COLORS.muted}>{index + 1}</Td>
							<Td>
								<Flex align="center" gap={3}>
									<ProductThumbnail name={item.name} imageUrl={item.imageUrl} />
									<Box minW={0}>
										<Text fontWeight={600} fontSize="sm" noOfLines={1}>
											{item.name}
										</Text>
										{item.modelCode && (
											<Text
												fontSize="xs"
												color={PAGE_COLORS.muted}
												noOfLines={1}
											>
												{item.modelCode}
											</Text>
										)}
									</Box>
								</Flex>
							</Td>
							{/* <Td color={PAGE_COLORS.muted} whiteSpace="nowrap">
								{item.barcode ?? '-'}
							</Td> */}
							<Td>
								{isReadOnly ? (
									<TextLabel label="" value={item.quantity.toString()} />
								) : (
									<EditableNumberField
										value={item.quantity}
										isEditable
										fontSize="sm"
										fontWeight={600}
										fieldId={lineItemFieldId(item.id, 'quantity')}
										registerEditStart={registerEditStart}
										onEnterCommit={() => focusNextField(index, 'quantity')}
										onSave={quantity => handleQuantityEdit(item, quantity)}
									/>
								)}
							</Td>
							<Td>
								<CurrencyAmountTooltip
									amount={item.unitPrice}
									displayText={formatAmount(item.unitPrice)}
									options={currencyOptions}
									displayCurrencyId={displayCurrencyId}
									fieldId={lineItemFieldId(item.id, 'unitPrice')}
									registerEditStart={registerEditStart}
									onEnterCommit={() => focusNextField(index, 'unitPrice')}
									onEdit={
										isReadOnly
											? undefined
											: unitPrice => handleUnitPriceEdit(item, unitPrice)
									}
									costReference={
										invoiceKind === 'selling'
											? {
													averageBuying:
														item.averageCost != null
															? formatAmount(item.averageCost)
															: '-',
													lastBuying:
														item.lastBuyingPrice != null
															? formatAmount(item.lastBuyingPrice)
															: '-',
													lastSelling:
														item.lastSellingPrice != null
															? formatAmount(item.lastSellingPrice)
															: '-',
												}
											: undefined
									}
								/>
							</Td>
							<Td>
								{isReadOnly ? (
									<Text fontSize="sm" fontWeight={600}>
										{formatAmount(getLineDiscountAmount(item))}
									</Text>
								) : (
									<EditableDiscountField
										discount={item.discount}
										discountIsPercent={item.discountIsPercent}
										discountAmount={getLineDiscountAmount(item)}
										formatAmount={formatAmount}
										fontSize="sm"
										fontWeight={600}
										fieldId={lineItemFieldId(item.id, 'discount')}
										registerEditStart={registerEditStart}
										onEnterCommit={() => focusNextField(index, 'discount')}
										onSave={(discount, discountIsPercent) =>
											handleDiscountEdit(item, discount, discountIsPercent)
										}
									/>
								)}
							</Td>
							<Td>
								<CurrencyAmountTooltip
									amount={calculateLineItemTotal(item)}
									displayText={formatAmount(calculateLineItemTotal(item))}
									options={currencyOptions}
									displayCurrencyId={displayCurrencyId}
									fieldId={lineItemFieldId(item.id, 'total')}
									registerEditStart={registerEditStart}
									onEnterCommit={() => focusNextField(index, 'total')}
									onEdit={
										isReadOnly
											? undefined
											: total => handleTotalEdit(item, total)
									}
								/>
							</Td>
							{!isReadOnly && (
								<Td>
									<IconButton
										size="xs"
										variant="ghost"
										aria-label={t(
											'components.sellingInvoices.drawer.removeItem',
										)}
										icon={
											<AsTrashIcon
												fill="none"
												color={PAGE_COLORS.danger}
												boxSize={4}
											/>
										}
										onClick={() => onRemoveItem(item.id)}
									/>
								</Td>
							)}
						</Tr>
					))}
				</Tbody>
			</Table>
		</Box>
	)
}

export default InvoiceLineItemsTable
