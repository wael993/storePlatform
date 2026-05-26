import {
	Heading,
	Modal,
	Text,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	VStack,
	Tabs,
	TabList,
	Tab,
	ModalFooter,
	Button,
	TabPanels,
	TabPanel,
	SimpleGrid,
} from '@chakra-ui/react'
import React, { useRef, useState } from 'react'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { useTranslation } from 'react-i18next'
import { AsCheckmarkCircleIcon } from '../../icons/CheckmarkCircle'
import DailyActionDataTab from './DailyActionDataTab'
import { ActionTypes, StepKeys } from '../../shared/globalEnums'

const styles: StylesObject = {
	modalHeader: { paddingTop: '2.5rem', paddingLeft: '2.5rem' },
	headerContainer: { alignItems: 'flex-start' },
	headingInfo: { paddingBottom: '0' },
	subHeaderDescription: {
		fontWeight: 700,
		color: '#939596',
		fontSize: '0.875rem',
	},
	isInputLockedWarning: { color: '#F6655B', fontSize: '0.75rem' },
	modalCloseButton: { marginTop: '0.9rem', marginRight: '0.4rem' },
	modalBody: {
		paddingLeft: '2.5rem',
		paddingRight: '2.5rem',
	},
	bodyContainer: {
		alignItems: 'flex-start',
		gap: 0,
	},
	currentStepInfo: { color: '#747474', fontSize: '0.75rem', fontWeight: 700 },
	tabs: { width: '100%' },
	tabList: { width: '100%', borderBottom: '2px solid #DADADA' },
	tab: {
		paddingTop: '0.3rem',
		paddingBottom: '0',
		justifyContent: 'left',
		mb: '-2px',
	},
	tabPanels: { marginTop: '2rem', minHeight: '20rem' },
	tabPanel: { paddingLeft: '0', paddingRight: '0', marginBottom: '2rem' },
	thirdLine: { marginTop: '2rem', gap: 6 },
	modalFooter: {
		paddingRight: '2.5rem',
		paddingBottom: '2.5rem',
	},
	addContentWrapper: { marginTop: '0.5rem' },
	gwpDownloadImgButton: {
		height: 'unset',
		minW: 'unset',
		width: 'fit-content',
		bg: 'transparent',
		fontSize: '2xl',
		color: '#676767',
		margin: 0,
		padding: 0,
		display: 'block',
		...hoverFocusActiveButtonStyles,
	},
	gwpPreviewButton: {
		height: 'unset',
		minW: 'unset',
		width: 'fit-content',
		fontSize: '2xl',
		color: '#676767',
		margin: 0,
		padding: 0,
		cursor: 'pointer',
		...hoverFocusActiveButtonStyles,
	},
	gwpButtonText: {
		maxWidth: '15ch',
		textOverflow: 'ellipsis',
	},
	gwpButtonWrapper: {
		gap: '0.5rem',
	},
	modalOverlay: {
		zIndex: '998',
	},
	secondaryButton: {
		backgroundColor: '#EAEAEA',
		fontSize: '0.875rem',
		whiteSpace: 'nowrap',
	},
	button: {
		margin: { base: '0 0 1rem 2rem', md: '1rem' },
		backgroundColor: '#376288',
		fontSize: '0.875rem',
		p: { base: '4', md: '1rem 1.5rem 1rem 1.5rem' },
		whiteSpace: 'nowrap',
		borderRadius: '0',
		...hoverFocusActiveButtonStyles,
	},
	actionButton: {
		h: '90px',
		borderRadius: 'xl',
		fontSize: 'lg',
		fontWeight: 'bold',
		bgGradient: 'linear(to-r, blue.500, cyan.400)',
		color: 'white',
		boxShadow: 'lg',
		transition: 'all 0.25s ease',
		_hover: {
			transform: 'translateY(-4px)',
			boxShadow: '2xl',
			bgGradient: 'linear(to-r, blue.600, cyan.500)',
		},
		_active: {
			transform: 'scale(0.97)',
		},
	},
}

interface DailyActionModalProps {
	isOpen: boolean
	onCloseModal: () => void
	initialTab: StepKeys
	isInputLocked?: boolean
}
const DailyActionModal = ({
	isOpen,
	onCloseModal,
	isInputLocked = false,
	initialTab,
}: DailyActionModalProps) => {
	const { t } = useTranslation()
	const activityLetterBodyRef = useRef<HTMLDivElement | null>(null)

	const [currentTabIndex, setCurrentTabIndex] = useState<number>(
		initialTab || 0,
	)
	const [actionType, setActionType] = useState<ActionTypes | ''>('')

	const onClose = () => {
		// setNewArticle({
		// 	...newArticle,
		// 	input: '',
		// 	multipleInput: '',
		// })
		// setSelectedGwpPreviewAttachment(null)
		setCurrentTabIndex(initialTab)
		onCloseModal()
	}
	const handleTabsChange = (index: number) => {
		setCurrentTabIndex(index)
	}

	const getTabStyle = (tabIndex: number) => {
		return {
			...styles.tab,
			// marginInlineStart: tabIndex > StepKeys.BasicInfo ? '1.25rem' : '0',
			borderBottom: `2px solid ${
				currentTabIndex === tabIndex ? '#376288' : '#DADADA'
			}`,
		}
	}

	const getTabTextStyle = (tabIndex: number) => {
		return {
			...styles.subHeaderDescription,
			// marginInlineStart: tabIndex > StepKeys.BasicInfo ? '1.25rem' : '0',
			color: `${currentTabIndex === tabIndex ? '#376288' : '#939596'}`,
		}
	}
	const isCurrentTabActionSummary = currentTabIndex === StepKeys.ActionSummery

	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={onClose}
				size="5xl"
				blockScrollOnMount={true}
				scrollBehavior="inside"
				motionPreset="slideInRight"
				closeOnOverlayClick={false}
				returnFocusOnClose={false}
			>
				<ModalOverlay sx={styles.modalOverlay} />
				<ModalContent
					containerProps={{
						zIndex: '998',
					}}
				>
					<ModalHeader sx={styles.modalHeader}>
						<VStack sx={styles.headerContainer}>
							<Heading variant="h4" sx={styles.headingInfo}>
								{t('components.daily.dailyActions')}
							</Heading>

							{isInputLocked && (
								<Text sx={styles.isInputLockedWarning}>
									{t('components.daily.inputLockedWarning')}
								</Text>
							)}
						</VStack>
					</ModalHeader>
					<ModalCloseButton size="lg" sx={styles.modalCloseButton} />

					<ModalBody sx={styles.modalBody}>
						<VStack sx={styles.bodyContainer} ref={activityLetterBodyRef}>
							<Tabs
								index={currentTabIndex}
								onChange={handleTabsChange}
								variant="unstyled"
								sx={styles.tabs}
							>
								<TabList sx={styles.tabList}>
									<Tab left={1} sx={getTabStyle(StepKeys.actionType)}>
										<Text sx={getTabTextStyle(StepKeys.actionType)}>
											{t('components.daily.actionType')}
										</Text>
									</Tab>
									<Tab sx={getTabStyle(StepKeys.ActionData)}>
										<Text sx={getTabTextStyle(StepKeys.ActionData)}>
											{t('components.daily.actionDate')}
										</Text>
									</Tab>
									<Tab sx={getTabStyle(StepKeys.ActionSummery)}>
										<Text sx={getTabTextStyle(StepKeys.ActionSummery)}>
											{t('components.daily.actionSummary')}
										</Text>
									</Tab>
								</TabList>
								<TabPanels sx={styles.tabPanels}>
									<TabPanel sx={styles.tabPanel}>
										<SimpleGrid columns={[1, 2, 3]} gap={6}>
											<Button sx={styles.actionButton}>حركة بيع</Button>
											<Button
												onClick={() => {
													setCurrentTabIndex(StepKeys.ActionData)
													setActionType(ActionTypes.purchase)
												}}
												sx={styles.actionButton}
											>
												حركة شراء
											</Button>
											<Button
												sx={styles.actionButton}
												onClick={() => {
													setCurrentTabIndex(StepKeys.ActionSummery)
													setActionType(ActionTypes.procurement)
												}}
											>
												حركة دفع
											</Button>
											<Button
												sx={styles.actionButton}
												onClick={() => {
													setCurrentTabIndex(StepKeys.ActionSummery)
													setActionType(ActionTypes.receipt)
												}}
											>
												حركة قبض
											</Button>
											<Button
												sx={styles.actionButton}
												onClick={() => {
													setCurrentTabIndex(StepKeys.ActionSummery)
													setActionType(ActionTypes.expense)
												}}
											>
												مصاريف
											</Button>
											<Button
												sx={styles.actionButton}
												onClick={() => {
													setCurrentTabIndex(StepKeys.ActionSummery)
													setActionType(ActionTypes.test)
												}}
											>
												اختبار
											</Button>
										</SimpleGrid>
									</TabPanel>

									<TabPanel sx={styles.tabPanel}>
										<DailyActionDataTab actionType={actionType} />
									</TabPanel>

									<TabPanel sx={styles.tabPanel} />
								</TabPanels>
							</Tabs>
						</VStack>
					</ModalBody>

					<ModalFooter sx={styles.modalFooter}>
						{isCurrentTabActionSummary && (
							<>
								<Button
									sx={{
										...styles.button,
										backgroundColor: '#EAEAEA',
										color: '#2B2B2B',
									}}
									onClick={onClose}
								>
									{t('common.cancel')}
								</Button>
								<Button
									rightIcon={
										<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />
									}
									size={'md'}
									variant={'primary'}
									sx={{
										...styles.button,
										backgroundColor: '#376288',
										color: '#FFFFFF',
									}}
								>
									{t('common.save')}
								</Button>
							</>
						)}
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	)
}

export default DailyActionModal
