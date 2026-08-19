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
import { useGetProductNotificationDigestQuery } from '../api/apiStore'
import { buildRoutePath, RoutePaths } from '../shared/routes'
import { cellFieldStyles } from '../shared/styles'
import { withNoValueFallback } from '../shared/utils'
import useAllowedActions from '../shared/hooks/useAllowedActions'
import EditableCellField from './list/EditableCellField'
import { useProductInlineEdit } from './product/useProductInlineEdit'

interface NegativeQuantityDigestModalProps {
	isOpen: boolean
	onClose: () => void
}

const DigestProductRow = ({
	product,
	onNavigate,
}: {
	product: Product
	onNavigate: () => void
}) => {
	const { t } = useTranslation()
	const { editField, isFieldInProgress } = useProductInlineEdit(product)
	const { seeStockQuantity, canEditStockQuantity } = useAllowedActions(
		RoutePaths.PRODUCTS,
	)

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
			{seeStockQuantity && (
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
	isOpen,
	onClose,
}: NegativeQuantityDigestModalProps) => {
	const { t } = useTranslation()
	const { data, isError, isFetching, isUninitialized, refetch } =
		useGetProductNotificationDigestQuery(undefined, { skip: !isOpen })
	const products = data?.products ?? []
	const showLoading = isUninitialized || (isFetching && !data)

	return (
		<Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
			<ModalOverlay />
			<ModalContent>
				<ModalHeader>
					{t('components.topBar.negativeQuantityDigestTitle')}
				</ModalHeader>
				<ModalCloseButton />
				<ModalBody pb={6} maxH="70vh" overflowY="auto">
					{showLoading ? (
						<Flex justify="center" py={8}>
							<Spinner />
						</Flex>
					) : isError ? (
						<Box>
							<Text mb={3}>
								{t('components.topBar.negativeQuantityDigestError')}
							</Text>
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
						<Text>{t('components.topBar.negativeQuantityDigestEmpty')}</Text>
					) : (
						products.map(product => (
							<DigestProductRow
								key={product.productId}
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
