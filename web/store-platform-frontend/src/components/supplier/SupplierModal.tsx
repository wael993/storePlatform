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
import TopSection from '../customer/TopSection'
import DailyActionsListWithActionBar from '../daily/list/DailyActionsListWithActionBar'

const fullWidth = '100%'
const pageContentPadding = '2rem'
const pageContentPaddingMobile = '1.25rem'
const modalContainerZIndex = 10

const styles = {
	grid: {
		gridTemplateColumns: 'repeat(12, 1fr)',
		paddingLeft: {
			base: pageContentPaddingMobile,
			md: pageContentPadding,
		},
		paddingRight: {
			base: pageContentPaddingMobile,
			md: pageContentPadding,
		},
		flexGrow: '1',
	},
	fullWidthSection: {
		width: fullWidth,
		gridColumn: '1 / span 12',
		paddingBottom: { base: '2rem', md: '3rem', lg: '2rem' },
	},
	errorSection: {
		width: fullWidth,
		gridColumn: '1 / span 12',
		paddingBottom: { base: '2rem', md: '3rem', lg: '2rem' },
		justifyContent: 'space-between',
		marginTop: '3rem',
	},
	errorTextBox: {
		width: '90%',
	},
	errorText: {
		marginTop: '7rem',
	},
	modalContent: {
		marginTop: '10rem',
		paddingBottom: 'clamp(5rem, 10vw, 9rem)',
		alignItems: 'center',
		zIndex: '1',
	},
	modalBody: {
		width: fullWidth,
		paddingX: 0,
		overflowY: 'auto',
	},
	closeButtonWrapper: {
		position: 'absolute',
		top: '2rem',
		right: '2rem',
	},
} satisfies StylesObject

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
				sx={styles.modalContent}
				containerProps={{ zIndex: modalContainerZIndex }}
			>
				<ModalBody sx={styles.modalBody} height={window.innerHeight}>
					<Box sx={styles.closeButtonWrapper}>
						{/* <CloseButton onClose={handleClose} /> */}
					</Box>
					<Grid sx={styles.grid}>
						{isSupplierLoading ? (
							<DetailModalSkeleton
								onClose={handleClose}
								targetType={targetType}
							/>
						) : !isSupplierError && supplier ? (
							<Box sx={styles.fullWidthSection}>
								<TopSection
									targetType={targetType}
									supplier={supplier}
									onClose={handleClose}
								/>
							</Box>
						) : (
							isSupplierError && (
								<Flex sx={styles.errorSection}>
									<Box sx={styles.errorTextBox}>
										<CenteredText
											text={t('components.supplier.errorLoadingSupplier')}
											customStyles={styles.errorText}
										/>
									</Box>
								</Flex>
							)
						)}
					</Grid>
					<DailyActionsListWithActionBar
						dailyActions={supplier?.relatedActions ?? []}
						isLoading={isSupplierLoading}
					/>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default SupplierModal
