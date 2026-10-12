import {
	ModalContent,
	Modal,
	ModalBody,
	Grid,
	Flex,
	Box,
} from '@chakra-ui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useGetSingleSupplierQuery } from '../../api/apiStore'
import { fullPaths } from '../../shared/routes'
import { TargetType } from '../../shared/globalEnums'
import CenteredText from '../common/CenteredText'
import DetailModalSkeleton from '../common/DetailModalSkeleton'
import PartyActivityTable from '../common/PartyActivityTable'
import type { ApiBuyingInvoice } from '../BuyingInvoice/buyingInvoiceApiMappers'
import type { ApiSellingInvoice } from '../SellingInvoice/invoiceApiMappers'
import TopSection from '../TopSection'
import {
	entityDetailModalContainerZIndex,
	entityDetailModalStyles,
} from '../common/entityDetailModalStyles'

interface SupplierModalProps {
	targetType: TargetType
}

const SupplierModal = ({ targetType }: SupplierModalProps) => {
	const params = useParams()
	const navigate = useNavigate()
	const { t } = useTranslation()

	const supplierId = params.supplierId as string
	const {
		data: supplier,
		isLoading: isSupplierLoading,
		isError: isSupplierError,
	} = useGetSingleSupplierQuery(supplierId)

	const handleClose = () => {
		if (window.history.state && window.history.length > 1) {
			navigate(-1)
			return
		}
		navigate(fullPaths.SUPPLIERS)
	}

	return (
		<Modal
			isOpen={true}
			onClose={handleClose}
			size="full"
			blockScrollOnMount={true}
			scrollBehavior="inside"
			motionPreset="slideInRight"
			closeOnOverlayClick={false}
			trapFocus={false}
			allowPinchZoom={true}
			preserveScrollBarGap={false}
		>
			<ModalContent
				sx={entityDetailModalStyles.modalContent}
				containerProps={{ zIndex: entityDetailModalContainerZIndex }}
			>
				<ModalBody sx={entityDetailModalStyles.modalBody}>
					<Grid sx={entityDetailModalStyles.grid}>
						{isSupplierLoading && !supplier ? (
							<DetailModalSkeleton
								onClose={handleClose}
								targetType={targetType}
							/>
						) : !isSupplierError && supplier ? (
							<Box sx={entityDetailModalStyles.fullWidthSection}>
								<TopSection
									targetType={targetType}
									supplier={supplier}
									onClose={handleClose}
								/>
							</Box>
						) : (
							isSupplierError && (
								<Flex sx={entityDetailModalStyles.errorSection}>
									<Box sx={entityDetailModalStyles.errorTextBox}>
										<CenteredText
											text={t('supplier.errorLoadingSupplier')}
											customStyles={entityDetailModalStyles.errorText}
										/>
									</Box>
								</Flex>
							)
						)}
					</Grid>
					<Box sx={entityDetailModalStyles.listSection}>
						{supplier ? (
							<PartyActivityTable
								party="supplier"
								partyId={supplier.supplierId}
								partyName={supplier.name}
								entries={supplier.supplierEntries ?? []}
								sellingInvoices={
									(supplier.sellingInvoices ?? []) as ApiSellingInvoice[]
								}
								buyingInvoices={(supplier.invoices ?? []) as ApiBuyingInvoice[]}
							/>
						) : null}
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default SupplierModal
