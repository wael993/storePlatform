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
import { useGetSingleCustomerQuery } from '../../api/apiStore'
import { fullPaths } from '../../shared/routes'
import { TargetType } from '../../shared/globalEnums'
import CenteredText from '../common/CenteredText'
import DetailModalSkeleton from '../common/DetailModalSkeleton'
import TopSection from '../TopSection'
import DailyActionsListWithActionBar from '../daily/list/DailyActionsListWithActionBar'
import CustomerInvoicesTab from './CustomerInvoicesTab'
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
						{isCustomerLoading && !customer ? (
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
						{customer ? (
							<Tabs sx={tabStyles.tabs} variant="unstyled">
								<TabList sx={tabStyles.tabList}>
									<Tab sx={tabStyles.tab}>
										<Text>{t('components.customer.invoices')}</Text>
									</Tab>
									<Tab sx={tabStyles.tab}>
										<Text>{t('components.customer.dailyActions')}</Text>
									</Tab>
								</TabList>
								<TabPanels>
									<TabPanel sx={tabStyles.tabPanel}>
										<CustomerInvoicesTab customerId={customer.customerId} />
									</TabPanel>
									<TabPanel sx={tabStyles.tabPanel}>
										<DailyActionsListWithActionBar
											dailyActions={customer.relatedActions ?? []}
											isLoading={isCustomerLoading && !customer}
											embedded
										/>
									</TabPanel>
								</TabPanels>
							</Tabs>
						) : (
							<DailyActionsListWithActionBar
								dailyActions={[]}
								isLoading={isCustomerLoading}
								embedded
							/>
						)}
					</Box>
				</ModalBody>
			</ModalContent>
		</Modal>
	)
}

export default CustomerModal
