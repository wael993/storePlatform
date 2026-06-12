import {
	Modal,
	ModalOverlay,
	ModalContent,
	ModalHeader,
	Text,
	VStack,
	ModalBody,
	Button,
	ModalFooter,
	Spinner,
	Box,
	useDisclosure,
	Tooltip,
	ModalCloseButton,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import MultiStepper from '../../common/MultiStepper'
import { isEqual } from 'lodash'
import ConfirmationDialog from '../../ConfirmationDialog'
import { AsSendIcon } from '../../icons/Send'
import { DailyActionType, StepKeys } from '../../../shared/globalEnums'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'

import { ChevronRightIcon } from '../../icons/ChevronRight'
import FirstStep from './AddDailyActionSteps/FirstStep'
import SecondStep from './AddDailyActionSteps/SecondStep'
import { useDailyActionHandlers } from './hooks/useDailyActionHandlers'
import ThirdStep from './AddDailyActionSteps/ThirdStep'

const styles = {
	header: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: '0.625rem',
		borderBottom: `1px solid #EAEAEA`,
	},
	headerTitleStepperContainer: {
		alignItems: 'flex-start',
		gap: '0.625rem',
	},
	headerText: {
		fontWeight: 700,
		fontSize: '1.25rem',
	},
	body: {
		minHeight: '50vh',
		padding: '1.25rem',
	},
	modalCloseButton: { marginTop: '0.9rem', marginRight: '0.4rem' },
	bodyHeading: {
		fontWeight: 700,
		fontSize: '1rem',
		marginBottom: '1.25rem',
	},
	button: {
		margin: { base: '0 0 1rem 2rem', md: '1rem 1rem 1rem 0rem' },
		backgroundColor: '#376288',
		fontSize: '0.875rem',
		color: '#FFFFFF',
		p: { base: '4', md: '1rem 1.5rem 1rem 1.5rem' },
		whiteSpace: 'nowrap',
		borderRadius: '0',
		...hoverFocusActiveButtonStyles,
	},
	secondaryButton: {
		backgroundColor: '#EAEAEA',
		color: '#1E1E1E',
	},
	footer: {
		gap: '0.5rem',
		borderTop: `1px solid #EAEAEA`,
	},
	spinnerContainer: {
		height: '100%',
		width: '100%',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
	},
} satisfies StylesObject

interface AddDailyActionModalProps {
	isOpen: boolean
	onClose: () => void
}

const AddDailyActionModal = ({ isOpen, onClose }: AddDailyActionModalProps) => {
	const {
		setStep,
		setFormData,
		setEntryType,
		handleInputChange,
		handleDropdownChange,
		handleSaveDailyAction,
		isSavingDailyAction,
		step,
		formData,
		entryType,
		totalPrice,
		bodyHeading,
		unit,
		products,
		isAllDataLoaded,
		suppliers,
		customers,
		currency,
	} = useDailyActionHandlers({ shouldLoadOptions: isOpen })

	const { t } = useTranslation()

	const [shouldLeavingBeQuestioned, setShouldLeavingBeQuestioned] =
		useState<boolean>(false)
	const [newDailyAction, setNewDailyAction] = useState<Partial<DailyAction>>()

	useEffect(() => {
		if (!isOpen) {
			setEntryType([])
			setFormData(undefined)
			setNewDailyAction(undefined)
			setStep(StepKeys.ACTION_TYPE)
		}
	}, [isOpen, setEntryType, setFormData, setStep])

	const handleEntryTypeChange = (values: DropdownOption[]) => {
		setEntryType(values)
		setFormData(prev => ({
			...prev,
			entryType: values[0]?.value as DailyAction['entryType'] | undefined,
		}))
	}

	const actionEntryTypesOptions: DropdownOption[] = [
		{
			value: DailyActionType.BUYING_ENTRY,
			label: 'حركة شراء',
		},
		{
			value: DailyActionType.SELLING_ENTRY,
			label: 'حركة بيع',
		},
		{
			value: DailyActionType.PAYMENT_ENTRY,
			label: 'حركة دفع',
		},
		{
			value: DailyActionType.RECEIPT_ACTION,
			label: 'حركة قبض',
		},
	]

	const isSellingEntry = entryType?.[0]?.value === 'SELLING_ENTRY'
	const isBuyingEntry = entryType?.[0]?.value === 'BUYING_ENTRY'
	const isReceiptAction = entryType?.[0]?.value === 'RECEIPT_ACTION'
	const isPaymentEntry = entryType?.[0]?.value === 'PAYMENT_ENTRY'

	const {
		isOpen: isLeavingModalOpen,
		onClose: onCloseLeavingModal,
		onOpen: onOpenLeavingModal,
	} = useDisclosure()

	useEffect(() => {
		setShouldLeavingBeQuestioned(!isEqual(formData, undefined))
	}, [formData, newDailyAction])

	const handleCloseModal = (forceClose?: boolean) => {
		if (shouldLeavingBeQuestioned && !forceClose) {
			setNewDailyAction(undefined)
			setFormData(undefined)
			onOpenLeavingModal()
			setStep(StepKeys.ACTION_TYPE)
		} else {
			onClose()
		}
	}

	const isNextButtonDisabled = useMemo(() => {
		if (step === StepKeys.ACTION_TYPE) {
			return !entryType.length
		}
		if (step === StepKeys.ACTION_DATA) {
			if (isBuyingEntry && !formData?.supplierId) return true
			if (isSellingEntry && !formData?.customerId) return true
			return (
				!formData?.currencyId ||
				!formData?.unitId ||
				!formData?.weight ||
				!formData?.singleUnitPrice ||
				!totalPrice
			)
		}
	}, [
		step,
		entryType,
		isBuyingEntry,
		formData?.supplierId,
		formData?.customerId,
		formData?.currencyId,
		formData?.unitId,
		formData?.weight,
		formData?.singleUnitPrice,
		isSellingEntry,
		totalPrice,
	])

	const nextButtonDisabledTooltipText = useMemo(() => {
		if (!isNextButtonDisabled) return undefined

		switch (step) {
			case StepKeys.ACTION_TYPE:
				return t('components.daily.actionTypeMissing')
			case StepKeys.ACTION_DATA:
				return t('components.daily.actionDataMissing')
		}
	}, [isNextButtonDisabled, step, t])

	const isSubmitButtonDisabled = useMemo(() => {
		if (isSavingDailyAction || !formData?.invoiceNumber) return true

		return false
	}, [isSavingDailyAction, formData?.invoiceNumber])

	// const actionSummaryRows = getActionSummaryRows(formData)

	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={handleCloseModal}
				size="3xl"
				preserveScrollBarGap
				scrollBehavior="inside"
				isCentered
			>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader sx={styles.header}>
						<VStack sx={styles.headerTitleStepperContainer}>
							<Text sx={styles.headerText}>
								{t('components.daily.dailyActions')}
							</Text>
							<MultiStepper numberOfSteps={3} currentStep={step} />
						</VStack>
						<ModalCloseButton size="lg" sx={styles.modalCloseButton} />
					</ModalHeader>
					<ModalBody sx={styles.body}>
						{!isAllDataLoaded ? (
							<Box sx={styles.spinnerContainer}>
								<Spinner />
							</Box>
						) : (
							<>
								<Text sx={styles.bodyHeading}>{bodyHeading}</Text>
								{/* 1st Step */}
								{step === StepKeys.ACTION_TYPE && (
									<FirstStep
										actionEntryTypesOptions={actionEntryTypesOptions}
										entryType={entryType}
										setEntryType={handleEntryTypeChange}
									/>
								)}
								{/* 2nd Step */}
								{step === StepKeys.ACTION_DATA && (
									<SecondStep
										isBuyingEntry={isBuyingEntry}
										isSellingEntry={isSellingEntry}
										isReceiptAction={isReceiptAction}
										isPaymentEntry={isPaymentEntry}
										formData={formData}
										products={products}
										suppliers={suppliers}
										customers={customers}
										currency={currency}
										unit={unit}
										totalPrice={totalPrice ?? ''}
										handleDropdownChange={handleDropdownChange}
										handleInputChange={handleInputChange}
									/>
								)}

								{/* 3rd Step */}
								{step === StepKeys.ACTION_SUMMARY && (
									<ThirdStep
										formData={formData}
										handleInputChange={handleInputChange}
									/>
								)}
							</>
						)}
					</ModalBody>
					<ModalFooter sx={styles.footer}>
						{step === StepKeys.ACTION_TYPE ? (
							<Button
								sx={{ ...styles.button, ...styles.secondaryButton }}
								onClick={() => handleCloseModal()}
							>
								{t('common.cancel')}
							</Button>
						) : (
							<Button
								sx={{ ...styles.button, ...styles.secondaryButton }}
								onClick={() => setStep(prevStep => prevStep - 1)}
								isDisabled={isSavingDailyAction}
							>
								{t('common.back')}
							</Button>
						)}
						{step === StepKeys.ACTION_SUMMARY ? (
							<Tooltip
								label={
									isSubmitButtonDisabled
										? t('components.daily.invoiceNumberMissing')
										: undefined
								}
							>
								<Button
									sx={{ ...styles.button, ...styles.secondaryButton }}
									variant={'primary'}
									onClick={() => {
										handleSaveDailyAction()
										setShouldLeavingBeQuestioned(false)
										onClose()
									}}
									leftIcon={<AsSendIcon />}
									isDisabled={isSubmitButtonDisabled}
									isLoading={isSavingDailyAction}
								>
									{t('common.submit')}
								</Button>
							</Tooltip>
						) : (
							<Tooltip label={nextButtonDisabledTooltipText}>
								<Button
									sx={styles.button}
									variant={'primary'}
									onClick={() => setStep(prevStep => prevStep + 1)}
									rightIcon={<ChevronRightIcon />}
									isDisabled={isNextButtonDisabled}
								>
									{t('common.nextStep')}
								</Button>
							</Tooltip>
						)}
					</ModalFooter>
				</ModalContent>
			</Modal>
			<ConfirmationDialog
				header={t('components.modal.leavingModal.header')}
				body={t('components.modal.leavingModal.body')}
				confirmationButtonText={t(
					'components.modal.leavingModal.confirmationButtonText',
				)}
				isOpen={isLeavingModalOpen}
				onClose={onCloseLeavingModal}
				onConfirm={() => {
					handleCloseModal(true)
				}}
				confirmIsPrimary
				cancelButtonText={t('common.cancel')}
			/>
		</>
	)
}

export default AddDailyActionModal
