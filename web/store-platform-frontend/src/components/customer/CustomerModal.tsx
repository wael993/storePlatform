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
import { useGetSingleCustomerQuery } from '../../api/apiStore'
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

interface CustomerModalProps {
	targetType: TargetType
}

const CustomerModal = ({ targetType }: CustomerModalProps) => {
	const params = useParams()
	const navigate = useNavigate()
	const { t } = useTranslation()

	const customerId = params.customerId as string
	const {
		data: customer,
		isLoading: isCustomerLoading,
		isError: isCustomerError,
	} = useGetSingleCustomerQuery(customerId)

	const handleClose = () => {
		if (window.history.state && window.history.length > 1) {
			navigate(-1)
			return
		}

		navigate(fullPaths.CUSTOMERS)
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
						{isCustomerLoading ? (
							<DetailModalSkeleton
								onClose={handleClose}
								targetType={targetType}
							/>
						) : !isCustomerError && customer ? (
							<Box sx={entityDetailModalStyles.fullWidthSection}>
								<TopSection
									targetType={targetType}
									customer={customer}
									onClose={handleClose}
								/>
							</Box>
						) : (
							isCustomerError && (
								<Flex sx={entityDetailModalStyles.errorSection}>
									<Box sx={entityDetailModalStyles.errorTextBox}>
										<CenteredText
											text={t('components.customer.errorLoadingCustomer')}
											customStyles={entityDetailModalStyles.errorText}
										/>
									</Box>
								</Flex>
							)
						)}
					</Grid>
					<Box sx={entityDetailModalStyles.listSection}>
						<DailyActionsListWithActionBar
							dailyActions={customer?.relatedActions ?? []}
							isLoading={isCustomerLoading}
							embedded
						/>
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default CustomerModal
