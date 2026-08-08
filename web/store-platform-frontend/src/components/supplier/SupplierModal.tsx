import {
	ModalContent,
	Modal,
	ModalBody,
	Grid,
	Flex,
	Box,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	Text,
} from '@chakra-ui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useGetSingleSupplierQuery } from '../../api/apiStore'
import { fullPaths } from '../../shared/routes'
import { TargetType } from '../../shared/globalEnums'
import CenteredText from '../common/CenteredText'
import DetailModalSkeleton from '../common/DetailModalSkeleton'
import TopSection from '../TopSection'
import DailyActionsListWithActionBar from '../daily/list/DailyActionsListWithActionBar'
import SupplierInvoicesTab from './SupplierInvoicesTab'
import {
	entityDetailModalContainerZIndex,
	entityDetailModalStyles,
} from '../common/entityDetailModalStyles'

const tabStyles = {
	tabs: {
		width: '100%',
	},
	tabList: {
		borderBottom: '1px solid #EAEAEA',
		gap: '0.5rem',
		px: { base: 2, md: 4 },
	},
	tab: {
		fontWeight: 600,
		fontSize: '0.95rem',
		color: '#929494',
		_selected: {
			color: '#376288',
			borderBottom: '2px solid #376288',
		},
	},
	tabPanel: {
		px: { base: 2, md: 4 },
		py: 4,
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
							<Tabs sx={tabStyles.tabs} variant="unstyled">
								<TabList sx={tabStyles.tabList}>
									<Tab sx={tabStyles.tab}>
										<Text>{t('components.supplier.invoices')}</Text>
									</Tab>
									<Tab sx={tabStyles.tab}>
										<Text>{t('components.supplier.dailyActions')}</Text>
									</Tab>
								</TabList>
								<TabPanels>
									<TabPanel sx={tabStyles.tabPanel}>
										<SupplierInvoicesTab supplierId={supplier.supplierId} />
									</TabPanel>
									<TabPanel sx={tabStyles.tabPanel}>
										<DailyActionsListWithActionBar
											dailyActions={supplier.relatedActions ?? []}
											isLoading={isSupplierLoading && !supplier}
											embedded
										/>
									</TabPanel>
								</TabPanels>
							</Tabs>
						) : (
							<DailyActionsListWithActionBar
								dailyActions={[]}
								isLoading={isSupplierLoading}
								embedded
							/>
						)}
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default SupplierModal
