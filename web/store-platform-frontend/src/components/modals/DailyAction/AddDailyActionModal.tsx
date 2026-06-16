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
import {
	DailyActionType,
	EntryType,
	StepKeys,
	TargetType,
} from '../../../shared/globalEnums'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import FirstStep from './AddDailyActionSteps/FirstStep'
import SecondStep from './AddDailyActionSteps/SecondStep'
import { useDailyActionHandlers } from './hooks/useDailyActionHandlers'
import ThirdStep from './AddDailyActionSteps/ThirdStep'
import { compareEntryType, compareLanguage } from '../../../shared/utils'
import { AsSendIcon } from '../../icons/Send'
import { ChevronRightIcon } from '../../icons/ChevronRight'
import { ChevronLeftIcon } from '../../icons/ChevronLeftIcon'

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
	targetType?: TargetType
	entryTargetId?: string
}

const AddDailyActionModal = ({
	isOpen,
	onClose,
	targetType,
	entryTargetId,
}: AddDailyActionModalProps) => {
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)

	const {
		setStep,
		setFormData,
		setEntryType,
		resetProductLines,
		handleInputChange,
		handleDropdownChange,
		handleProductLineDropdownChange,
		handleProductLineInputChange,
		addProductLine,
		removeProductLine,
		handleSaveDailyAction,
		isSavingDailyAction,
		step,
		formData,
		productLines,
		entryType,
		totalPrice,
		bodyHeading,
		unit,
		products,
		isAllDataLoaded,
		suppliers,
		customers,
		expenses,
		currency,
	} = useDailyActionHandlers({ shouldLoadOptions: isOpen })

	const {
		isSellingEntry,
		isBuyingEntry,
		isReceiptEntry,
		isPaymentEntry,
		isExpenseEntry,
	} = compareEntryType(entryType?.[0]?.value as EntryType)

	const [shouldLeavingBeQuestioned, setShouldLeavingBeQuestioned] =
		useState<boolean>(false)
	const [newDailyAction, setNewDailyAction] = useState<Partial<DailyAction>>()

	const {
		isOpen: isLeavingModalOpen,
		onClose: onCloseLeavingModal,
		onOpen: onOpenLeavingModal,
	} = useDisclosure()

	useEffect(() => {
		if (!isOpen) {
			setEntryType([])
			setFormData(undefined)
			setNewDailyAction(undefined)
			resetProductLines()
			setStep(StepKeys.ACTION_TYPE)
		}
	}, [isOpen, resetProductLines, setEntryType, setFormData, setStep])

	useEffect(() => {
		setShouldLeavingBeQuestioned(!isEqual(formData, undefined))
	}, [formData, newDailyAction])

	const handleEntryTypeChange = (values: DropdownOption[]) => {
		setEntryType(values)
		resetProductLines()
		setFormData({
			entryType: values[0]?.value as DailyAction['entryType'] | undefined,
		})
	}

	const getActionEntryTypesOptions = () => {
		if (targetType === TargetType.CUSTOMER) {
			return [
				{
					value: DailyActionType.SELLING_ENTRY,
					label: t('common.sellingEntry'),
				},
				{
					value: DailyActionType.RECEIPT_ENTRY,
					label: t('common.receiptEntry'),
				},
			]
		}
		if (targetType === TargetType.SUPPLIER) {
			return [
				{ value: DailyActionType.BUYING_ENTRY, label: t('common.buyingEntry') },
				{
					value: DailyActionType.PAYMENT_ENTRY,
					label: t('common.paymentEntry'),
				},
			]
		}
		if (targetType === TargetType.DAILY_ACTION) {
			return [
				{ value: DailyActionType.BUYING_ENTRY, label: t('common.buyingEntry') },
				{
					value: DailyActionType.SELLING_ENTRY,
					label: t('common.sellingEntry'),
				},
				{
					value: DailyActionType.RECEIPT_ENTRY,
					label: t('common.receiptEntry'),
				},
				{
					value: DailyActionType.PAYMENT_ENTRY,
					label: t('common.paymentEntry'),
				},
				{
					value: DailyActionType.EXPENSE_ENTRY,
					label: t('common.expenseEntry'),
				},
			]
		}
		return []
	}

	const actionEntryTypesOptions: DropdownOption[] = getActionEntryTypesOptions()

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
			if (isPaymentEntry) {
				return (
					!formData?.supplierId ||
					!formData?.currencyId ||
					!formData?.singleUnitPrice
				)
			}
			if (isReceiptEntry) {
				return (
					!formData?.customerId ||
					!formData?.currencyId ||
					!formData?.singleUnitPrice
				)
			}
			if (isExpenseEntry) {
				return (
					!formData?.expenseId ||
					!formData?.currencyId ||
					!formData?.singleUnitPrice
				)
			}

			if (isBuyingEntry && !formData?.supplierId) return true
			if (isSellingEntry && !formData?.customerId) return true
			if (
				!productLines.length ||
				productLines.some(
					productLine =>
						!productLine.productId ||
						!productLine.weight ||
						!productLine.singleUnitPrice ||
						!productLine.totalPrice,
				)
			) {
				return true
			}
			return (
				!formData?.currencyId ||
				!formData?.unitId ||
				!totalPrice
			)
		}
	}, [
		step,
		entryType.length,
		isPaymentEntry,
		formData?.supplierId,
		formData?.customerId,
		formData?.expenseId,
		formData?.currencyId,
		formData?.unitId,
		formData?.singleUnitPrice,
		isReceiptEntry,
		isExpenseEntry,
		isBuyingEntry,
		isSellingEntry,
		productLines,
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
		if (isSavingDailyAction || !formData?.invoiceDate) return true
		if (
			!isPaymentEntry &&
			!isReceiptEntry &&
			!isExpenseEntry &&
			!formData?.invoiceNumber
		) {
			return true
		}

		return false
	}, [
		isSavingDailyAction,
		formData?.invoiceDate,
		formData?.invoiceNumber,
		isPaymentEntry,
		isReceiptEntry,
		isExpenseEntry,
	])

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
						<ModalCloseButton
							size="lg"
							sx={{
								...styles.modalCloseButton,
								left: isArabic ? '0.4rem' : 'auto',
								right: isArabic ? 'auto' : '0.4rem',
								marginRight: 0,
							}}
						/>
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
										entryTargetId={entryTargetId}
										isBuyingEntry={isBuyingEntry}
										isSellingEntry={isSellingEntry}
										isReceiptEntry={isReceiptEntry}
										isPaymentEntry={isPaymentEntry}
										isExpenseEntry={isExpenseEntry}
										formData={formData}
										productLines={productLines}
										products={products}
										suppliers={suppliers}
										customers={customers}
										expenses={expenses}
										currency={currency}
										unit={unit}
										totalPrice={totalPrice ?? ''}
										handleDropdownChange={handleDropdownChange}
										handleInputChange={handleInputChange}
										handleProductLineDropdownChange={
											handleProductLineDropdownChange
										}
										handleProductLineInputChange={handleProductLineInputChange}
										addProductLine={addProductLine}
										removeProductLine={removeProductLine}
									/>
								)}

								{/* 3rd Step */}
								{step === StepKeys.ACTION_SUMMARY && (
									<ThirdStep
										formData={formData}
										productLines={productLines}
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
										? t('components.daily.invoiceDetailsMissing', {
												defaultValue:
													'Please enter the invoice number and invoice date to continue.',
											})
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
									{...(isArabic
										? {
												rightIcon: (
													<AsSendIcon sx={{ transform: 'rotate(260deg)' }} />
												),
											}
										: {
												leftIcon: <AsSendIcon />,
											})}
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
									rightIcon={
										!isArabic ? <ChevronRightIcon /> : <ChevronLeftIcon />
									}
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
