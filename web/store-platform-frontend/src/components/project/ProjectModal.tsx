import {
	ModalContent,
	Modal,
	ModalBody,
	Grid,
	Flex,
	Box,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useGetSingleProjectQuery } from '../../api/apiStore'
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

const ProjectModal = () => {
	const params = useParams()
	const navigate = useNavigate()
	const { t } = useTranslation()

	const projectId = params.projectId as string
	const {
		data: project,
		isLoading: isProjectLoading,
		isError: isProjectError,
	} = useGetSingleProjectQuery(projectId)

	const handleClose = () => {
		if (window.history.state && window.history.length > 1) {
			navigate(-1)
			return
		}

		navigate(fullPaths.PROJECTS)
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
						{isProjectLoading && !project ? (
							<DetailModalSkeleton
								onClose={handleClose}
								targetType={TargetType.PROJECT}
							/>
						) : !isProjectError && project ? (
							<Box sx={entityDetailModalStyles.fullWidthSection}>
								<TopSection
									targetType={TargetType.PROJECT}
									project={project}
									onClose={handleClose}
								/>
							</Box>
						) : (
							isProjectError && (
								<Flex sx={entityDetailModalStyles.errorSection}>
									<Box sx={entityDetailModalStyles.errorTextBox}>
										<CenteredText
											text={t('components.project.errorLoadingProject')}
											customStyles={entityDetailModalStyles.errorText}
										/>
									</Box>
								</Flex>
							)
						)}
					</Grid>
					<Box sx={entityDetailModalStyles.listSection}>
						{project ? (
							<PartyActivityTable
								party="project"
								partyId={project.projectId}
								partyName={project.name}
								entries={project.projectEntries ?? []}
								sellingInvoices={
									(project.invoices ?? []) as ApiSellingInvoice[]
								}
								buyingInvoices={
									(project.buyingInvoices ?? []) as ApiBuyingInvoice[]
								}
							/>
						) : null}
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default ProjectModal
