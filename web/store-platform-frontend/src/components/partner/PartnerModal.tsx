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
import TopSection from '../TopSection'
import DailyActionsListWithActionBar from '../daily/list/DailyActionsListWithActionBar'
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
						{isPartnerLoading ? (
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
						<DailyActionsListWithActionBar
							dailyActions={partner?.relatedActions ?? []}
							isLoading={isPartnerLoading}
							embedded
						/>
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default PartnerModal
