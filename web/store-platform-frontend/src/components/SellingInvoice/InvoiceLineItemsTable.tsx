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
import { useTranslation } from 'react-i18next'
import { PAGE_COLORS } from './constants'
import { calculateLineItemTotal } from './invoiceCalculations'
import type { SellingInvoiceLineItem } from './types'
import { formatCurrency } from './utils'
import { AsTrashIcon } from '../../icons/Trash'
import { AsProductIcon } from '../../icons/Product'
import TextLabel from '../common/TextLabel'
// import { Dropdown } from '../dropdown/Dropdown'

interface InvoiceLineItemsTableProps {
	lineItems: SellingInvoiceLineItem[]
	onUpdateItem: (id: string, updates: Partial<SellingInvoiceLineItem>) => void
	onRemoveItem: (id: string) => void
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
	// onUpdateItem,
	onRemoveItem,
}: InvoiceLineItemsTableProps) => {
	const { t } = useTranslation()

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
			overflowX="auto"
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
						<Th>{t('components.sellingInvoices.drawer.columns.barcode')}</Th>
						<Th>{t('components.sellingInvoices.drawer.columns.qty')}</Th>
						<Th>{t('components.sellingInvoices.drawer.columns.price')}</Th>
						<Th>{t('components.sellingInvoices.drawer.columns.total')}</Th>
						<Th w="2.5rem" />
					</Tr>
				</Thead>
				<Tbody>
					{lineItems.map((item, index) => (
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
							<Td color={PAGE_COLORS.muted} whiteSpace="nowrap">
								{item.barcode ?? '-'}
							</Td>
							<Td>
								<TextLabel label="" value={item.quantity.toString()} />
							</Td>
							<Td>
								<TextLabel
									label=""
									value={`${item.unitPrice.toString()} ل.س`}
								/>
							</Td>
							<Td>
								<TextLabel
									label=""
									value={formatCurrency(calculateLineItemTotal(item))}
								/>
							</Td>
							<Td>
								<IconButton
									size="xs"
									variant="ghost"
									aria-label={t('components.sellingInvoices.drawer.removeItem')}
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
						</Tr>
					))}
				</Tbody>
			</Table>
		</Box>
	)
}

export default InvoiceLineItemsTable
