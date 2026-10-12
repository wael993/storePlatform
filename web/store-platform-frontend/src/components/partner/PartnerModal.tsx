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
import { useGetSinglePartnerQuery } from '../../api/apiStore'
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

interface PartnerModalProps {
	targetType: TargetType
}

const PartnerModal = ({ targetType }: PartnerModalProps) => {
	const params = useParams()
	const navigate = useNavigate()
	const { t } = useTranslation()

	const partnerId = params.partnerId as string
	const {
		data: partner,
		isLoading: isPartnerLoading,
		isError: isPartnerError,
	} = useGetSinglePartnerQuery(partnerId)

	const handleClose = () => {
		if (window.history.state && window.history.length > 1) {
			navigate(-1)
			return
		}

		navigate(fullPaths.PARTNERS)
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
						{isPartnerLoading && !partner ? (
							<DetailModalSkeleton
								onClose={handleClose}
								targetType={targetType}
							/>
						) : !isPartnerError && partner ? (
							<Box sx={entityDetailModalStyles.fullWidthSection}>
								<TopSection
									targetType={targetType}
									partner={partner}
									onClose={handleClose}
								/>
							</Box>
						) : (
							isPartnerError && (
								<Flex sx={entityDetailModalStyles.errorSection}>
									<Box sx={entityDetailModalStyles.errorTextBox}>
										<CenteredText
											text={t('partner.errorLoadingPartner')}
											customStyles={entityDetailModalStyles.errorText}
										/>
									</Box>
								</Flex>
							)
						)}
					</Grid>
					<Box sx={entityDetailModalStyles.listSection}>
						{partner ? (
							<PartyActivityTable
								party="partner"
								partyId={partner.partnerId}
								partyName={partner.name}
								entries={partner.partnerEntries ?? []}
								sellingInvoices={
									(partner.sellingInvoices ?? []) as ApiSellingInvoice[]
								}
								buyingInvoices={
									(partner.buyingInvoices ?? []) as ApiBuyingInvoice[]
								}
							/>
						) : null}
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default PartnerModal
