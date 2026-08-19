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
	MISSING_RETAIL_PRICE_DIGEST,
	NEGATIVE_QUANTITY_DIGEST,
	PRODUCT_DIGEST_I18N,
	ProductDigestType,
	RETAIL_BELOW_PURCHASE_DIGEST,
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
	const {
		seeStockQuantity,
		canEditStockQuantity,
		seeBuyCost,
		canEditBuyCost,
		seeWholesalePrice,
		canEditWholesalePrice,
	} = useAllowedActions(RoutePaths.PRODUCTS)

	const field =
		digestType === MISSING_PURCHASE_PRICE_DIGEST
			? 'purchasePrice'
			: digestType === MISSING_RETAIL_PRICE_DIGEST ||
				  digestType === RETAIL_BELOW_PURCHASE_DIGEST
				? 'retailPrice'
				: 'quantity'

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
			{field === 'purchasePrice'
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
				: field === 'retailPrice'
					? (seeWholesalePrice ||
							(digestType === RETAIL_BELOW_PURCHASE_DIGEST && seeBuyCost)) && (
							<Flex align="center" gap={4}>
								{digestType === RETAIL_BELOW_PURCHASE_DIGEST && seeBuyCost && (
									<EditableCellField
										value={product.price?.purchasePrice?.toLocaleString() ?? ''}
										isNumberField={false}
										ariaLabel={t('common.buyCost')}
										isEditable={false}
										customStyles={cellFieldStyles}
									/>
								)}
								{seeWholesalePrice && (
									<EditableCellField
										value={product.price?.retailPrice?.toLocaleString() ?? ''}
										isNumberField={true}
										ariaLabel={t('common.sellPrice')}
										onEdit={value => editField('retailPrice', value)}
										isEditable={canEditWholesalePrice}
										customStyles={cellFieldStyles}
										isLoading={isFieldInProgress('retailPrice')}
									/>
								)}
							</Flex>
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
	const copyKey = digestType
		? PRODUCT_DIGEST_I18N[digestType]
		: PRODUCT_DIGEST_I18N[NEGATIVE_QUANTITY_DIGEST]

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
