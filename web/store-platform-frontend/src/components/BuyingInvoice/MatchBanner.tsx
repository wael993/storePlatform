import { Button, HStack, Text, VStack } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { PAGE_COLORS } from '../SellingInvoice/constants'
import {
	formatConfidencePercent,
	type EntityMatch,
} from '../../shared/invoiceExtraction'

interface MatchBannerProps {
	kind: 'product' | 'supplier'
	match?: EntityMatch
	isReadOnly?: boolean
	onConfirm?: () => void
	onCreate?: () => void
	onFind?: () => void
}

const MatchBanner = ({
	kind,
	match,
	isReadOnly,
	onConfirm,
	onCreate,
	onFind,
}: MatchBannerProps) => {
	const { t } = useTranslation()

	if (!match) return null
	if (!match.id && !match.invoiceName) return null

	const percent = formatConfidencePercent(match.confidence)
	const isProduct = kind === 'product'
	const findButton =
		isProduct && onFind && !isReadOnly ? (
			<Button size="xs" variant="outline" onClick={onFind}>
				{t('components.buyingInvoices.extract.match.findInProducts')}
			</Button>
		) : null

	if (match.autoLink && match.name) {
		return (
			<VStack align="stretch" spacing={1} mt={1}>
				<Text fontSize="xs" color={PAGE_COLORS.success}>
					{t(
						isProduct
							? 'components.buyingInvoices.extract.match.linkedProduct'
							: 'components.buyingInvoices.extract.match.linkedSupplier',
						{ name: match.name, percent: percent ?? '—' },
					)}
				</Text>
				{findButton}
			</VStack>
		)
	}

	if (match.confirmed) {
		return findButton ? (
			<VStack align="stretch" spacing={1} mt={1}>
				{findButton}
			</VStack>
		) : null
	}

	if (match.id && match.name) {
		return (
			<VStack align="stretch" spacing={1} mt={1}>
				<Text fontSize="xs" color={PAGE_COLORS.warning}>
					{t(
						isProduct
							? 'components.buyingInvoices.extract.match.possibleProduct'
							: 'components.buyingInvoices.extract.match.possibleSupplier',
						{ name: match.name, percent: percent ?? '—' },
					)}
				</Text>
				{!isReadOnly && (
					<HStack spacing={1} flexWrap="wrap">
						<Button size="xs" colorScheme="green" onClick={onConfirm}>
							{t('components.buyingInvoices.extract.match.confirm')}
						</Button>
						<Button size="xs" variant="outline" onClick={onCreate}>
							{t(
								isProduct
									? 'components.buyingInvoices.extract.match.createProduct'
									: 'components.buyingInvoices.extract.match.createSupplier',
							)}
						</Button>
						{findButton}
					</HStack>
				)}
			</VStack>
		)
	}

	return (
		<VStack align="stretch" spacing={1} mt={1}>
			<Text fontSize="xs" color={PAGE_COLORS.danger}>
				{t(
					isProduct
						? 'components.buyingInvoices.extract.match.newProduct'
						: 'components.buyingInvoices.extract.match.newSupplier',
				)}
			</Text>
			{!isReadOnly && (
				<HStack spacing={1} flexWrap="wrap">
					<Button size="xs" colorScheme="blue" onClick={onCreate}>
						{t(
							isProduct
								? 'components.buyingInvoices.extract.match.createProduct'
								: 'components.buyingInvoices.extract.match.createSupplier',
						)}
					</Button>
					{findButton}
				</HStack>
			)}
		</VStack>
	)
}

export default MatchBanner
