import {
	Box,
	Flex,
	Link,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Spinner,
	Text,
} from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
	MISSING_PURCHASE_PRICE_DIGEST,
	NEGATIVE_QUANTITY_DIGEST,
	ProductDigestType,
	useGetProductNotificationDigestQuery,
} from '../api/apiStore'
import { buildRoutePath, RoutePaths } from '../shared/routes'
import { cellFieldStyles } from '../shared/styles'
import { withNoValueFallback } from '../shared/utils'
import useAllowedActions from '../shared/hooks/useAllowedActions'
import EditableCellField from './list/EditableCellField'
import { useProductInlineEdit } from './product/useProductInlineEdit'

interface NegativeQuantityDigestModalProps {
	digestType: ProductDigestType | null
	isOpen: boolean
	onClose: () => void
}

const DigestProductRow = ({
	digestType,
	product,
	onNavigate,
}: {
	digestType: ProductDigestType
	product: Product
	onNavigate: () => void
}) => {
	const { t } = useTranslation()
	const { editField, isFieldInProgress } = useProductInlineEdit(product)
	const { seeStockQuantity, canEditStockQuantity, seeBuyCost, canEditBuyCost } =
		useAllowedActions(RoutePaths.PRODUCTS)
	const isMissingPurchasePrice = digestType === MISSING_PURCHASE_PRICE_DIGEST

	return (
		<Flex
			align="center"
			justify="space-between"
			gap={4}
			py={3}
			borderBottom="1px solid #ECECEC"
		>
			<Link
				as={RouterLink}
				to={buildRoutePath.productById(product.productId)}
				fontWeight={700}
				color="#353535"
				onClick={onNavigate}
			>
				{product.name}
			</Link>
			{isMissingPurchasePrice
				? seeBuyCost && (
						<EditableCellField
							value={product.price?.purchasePrice?.toLocaleString() ?? ''}
							isNumberField={false}
							ariaLabel={t('common.buyCost')}
							placeholder={t('common.addBuyCost')}
							onEdit={value => editField('purchasePrice', value)}
							isEditable={canEditBuyCost}
							customStyles={cellFieldStyles}
							isLoading={isFieldInProgress('purchasePrice')}
						/>
					)
				: seeStockQuantity && (
						<EditableCellField
							value={withNoValueFallback(
								product.inventory?.quantity?.toLocaleString(),
							)}
							isNumberField={true}
							minimumDecimals={0}
							ariaLabel={t('common.stockQuantity')}
							onEdit={value => editField('quantity', value)}
							isEditable={canEditStockQuantity}
							customStyles={cellFieldStyles}
							isLoading={isFieldInProgress('quantity')}
						/>
					)}
		</Flex>
	)
}

const NegativeQuantityDigestModal = ({
	digestType,
	isOpen,
	onClose,
}: NegativeQuantityDigestModalProps) => {
	const { t } = useTranslation()
	const { data, isError, isFetching, isUninitialized, refetch } =
		useGetProductNotificationDigestQuery(
			digestType ?? NEGATIVE_QUANTITY_DIGEST,
			{
				skip: !isOpen || !digestType,
			},
		)
	const products = data?.products ?? []
	const showLoading = isUninitialized || (isFetching && !data)
	const copyKey =
		digestType === MISSING_PURCHASE_PRICE_DIGEST
			? 'missingPurchasePriceDigest'
			: 'negativeQuantityDigest'

	return (
		<Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
			<ModalOverlay />
			<ModalContent>
				<ModalHeader>{t(`components.topBar.${copyKey}Title`)}</ModalHeader>
				<ModalCloseButton />
				<ModalBody pb={6} maxH="70vh" overflowY="auto">
					{showLoading ? (
						<Flex justify="center" py={8}>
							<Spinner />
						</Flex>
					) : isError ? (
						<Box>
							<Text mb={3}>{t(`components.topBar.${copyKey}Error`)}</Text>
							<Box
								as="button"
								type="button"
								fontWeight={700}
								onClick={() => {
									void refetch()
								}}
							>
								{t('common.retry')}
							</Box>
						</Box>
					) : products.length === 0 ? (
						<Text>{t(`components.topBar.${copyKey}Empty`)}</Text>
					) : (
						digestType &&
						products.map(product => (
							<DigestProductRow
								key={product.productId}
								digestType={digestType}
								product={product}
								onNavigate={onClose}
							/>
						))
					)}
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default NegativeQuantityDigestModal
