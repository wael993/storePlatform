import { useEffect, useState } from 'react'
import {
	Button,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import {
	useGetProductImportStatusQuery,
	useSkipProductImportMutation,
} from '../../api/apiStore'
import { useUser } from '../../shared/hooks/useUser'
import {
	PRODUCT_IMPORT_STATUS,
	productImportLaterKey,
} from '../../shared/productImport'
import ProductImportWizardModal from './ProductImportWizardModal'

interface ProductImportGateProps {
	onLaterChange: (showTopBarButton: boolean) => void
	openWizardSignal: number
}

const ProductImportGate = ({
	onLaterChange,
	openWizardSignal,
}: ProductImportGateProps) => {
	const { t } = useTranslation()
	const { isOwnerOrAdmin, user } = useUser()
	const tenantId = user?.tenantId
	const { data, isFetching } = useGetProductImportStatusQuery(undefined, {
		skip: !isOwnerOrAdmin,
	})
	const [skipImport, { isLoading: isSkipping }] = useSkipProductImportMutation()
	const [guideOpen, setGuideOpen] = useState(false)
	const [wizardOpen, setWizardOpen] = useState(false)

	const status = data?.status
	const isOpen =
		status === PRODUCT_IMPORT_STATUS.NOT_STARTED ||
		status === PRODUCT_IMPORT_STATUS.IN_PROGRESS
	const later =
		typeof window !== 'undefined' && tenantId
			? sessionStorage.getItem(productImportLaterKey(tenantId)) === '1'
			: false

	useEffect(() => {
		if (!isOwnerOrAdmin || isFetching || !status) {
			onLaterChange(false)
			return
		}

		if (!isOpen) {
			setGuideOpen(false)
			onLaterChange(false)
			return
		}

		if (status === PRODUCT_IMPORT_STATUS.IN_PROGRESS) {
			setGuideOpen(false)
			onLaterChange(true)
			return
		}

		if (later) {
			setGuideOpen(false)
			onLaterChange(true)
			return
		}

		setGuideOpen(true)
		onLaterChange(false)
	}, [isFetching, isOpen, isOwnerOrAdmin, later, onLaterChange, status])

	useEffect(() => {
		if (openWizardSignal > 0 && isOpen) {
			setWizardOpen(true)
		}
	}, [isOpen, openWizardSignal])

	if (!isOwnerOrAdmin) return null

	return (
		<>
			<Modal
				isOpen={guideOpen}
				onClose={() => undefined}
				isCentered
				closeOnOverlayClick={false}
				closeOnEsc={false}
			>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>{t('productImport.guideTitle')}</ModalHeader>
					<ModalBody>
						<VStack align="stretch" gap={3}>
							<Text>{t('productImport.guideBody')}</Text>
						</VStack>
					</ModalBody>
					<ModalFooter gap={3} flexWrap="wrap">
						<Button
							variant="ghost"
							onClick={() => {
								if (tenantId) {
									sessionStorage.setItem(productImportLaterKey(tenantId), '1')
								}
								setGuideOpen(false)
								onLaterChange(true)
							}}
						>
							{t('productImport.later')}
						</Button>
						<Button
							variant="ghost"
							isLoading={isSkipping}
							onClick={async () => {
								await skipImport().unwrap()
								setGuideOpen(false)
								onLaterChange(false)
							}}
						>
							{t('productImport.noProductList')}
						</Button>
						<Button
							onClick={() => {
								setGuideOpen(false)
								setWizardOpen(true)
							}}
						>
							{t('productImport.start')}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<ProductImportWizardModal
				isOpen={wizardOpen}
				onClose={() => setWizardOpen(false)}
				status={data}
			/>
		</>
	)
}

export default ProductImportGate
