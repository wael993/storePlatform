import { useTranslation } from 'react-i18next'

import {
	GridItem,
	Flex,
	Text,
	Box,
	SystemStyleObject,
	HStack,
	Icon,
	Tooltip,
} from '@chakra-ui/react'
import { compareEntryType } from '../../shared/utils'
import { EntryModalType } from '../../shared/globalEnums'
import { AsQuestionIcon } from '../icons/QuestionIcon'

interface TicketStatusProps {
	entryType: EntryModalType
	reasonName?: string
	showReasonName?: boolean
	customStyles?: Partial<Record<'itemTextBold', SystemStyleObject>>
	isMobileView?: boolean
}

export const TicketStatus = ({
	entryType,
	reasonName,
	showReasonName = false,
	customStyles,
	isMobileView = false,
}: TicketStatusProps) => {
	const { t } = useTranslation()
	const { isSupplierEntry } = compareEntryType(entryType)

	const MODAL_STATE_CONFIG: Partial<
		Record<EntryModalType, { translationKey: string; color: string }>
	> = {
		[EntryModalType.CUSTOMER_ENTRY]: {
			translationKey: 'زبون',
			color: '#5698E6',
		},
		[EntryModalType.SUPPLIER_ENTRY]: {
			translationKey: 'مورد',
			color: '#E7CB3A',
		},
		[EntryModalType.PRODUCT_ENTRY]: {
			translationKey: 'components.activity.states.inExecution',
			color: '#36CE4E',
		},
		[EntryModalType.DAILY_ACTION_ENTRY]: {
			translationKey: 'components.activity.states.done',
			color: '#C7C7C7',
		},
		[EntryModalType.PAYMENT_ENTRY]: {
			translationKey: 'components.activity.states.rejected',
			color: '#E45151',
		},
		[EntryModalType.RECEIPT_ENTRY]: {
			translationKey: 'components.activity.states.rejected',
			color: '#E45151',
		},
		[EntryModalType.SALE_ENTRY]: {
			translationKey: 'components.activity.states.rejected',
			color: '#E45151',
		},
	}

	const stateInfo = MODAL_STATE_CONFIG[entryType as EntryModalType] ?? {
		color: '#929494',
		translationKey: t('common.unknownState'),
	}

	const stateTitle: string = stateInfo ? stateInfo.translationKey : ''

	const styles = {
		colorCircle: {
			width: isSupplierEntry ? '0.875rem' : '1.25rem',
			height: isSupplierEntry ? '0.875rem' : '1.25rem',
			bgColor: stateInfo?.color ?? '#929494',
			borderRadius: 50,
		},
		rejectedText: {
			color: '#929494',
			fontSize: '0.8rem',
			fontWeight: 500,
			paddingLeft: '0.5rem',
			maxWidth: '10rem',
		},
		itemTextBold: {
			paddingLeft: '0.5rem',
			fontSize: isSupplierEntry && !isMobileView ? '0.875rem' : '1rem',
			fontWeight: isSupplierEntry && !isMobileView ? '500' : '700',
			overflow: 'hidden',
			textOverflow: 'ellipsis',
			whiteSpace: 'nowrap',
		},
		itemWrapperWithOneChild: {
			height: '100%',
			alignItems: 'center',
		},
		icon: {
			fontSize: '1.25rem',
			color: '#929494',
		},
	} satisfies StylesObject

	const shouldShowReason = showReasonName && Boolean(reasonName?.trim())

	return (
		<GridItem
			paddingBlock={{ base: isSupplierEntry ? '0 1rem' : '1rem 0.5rem', md: 0 }}
		>
			<Flex sx={styles.itemWrapperWithOneChild}>
				<Box sx={styles.colorCircle} />
				<Flex direction="column">
					<HStack>
						<Text
							variant="baseStyle"
							sx={customStyles?.itemTextBold ?? styles.itemTextBold}
						>
							{stateTitle}
						</Text>

						{shouldShowReason && !isMobileView && (
							<Tooltip label={reasonName}>
								<Icon sx={styles.icon} as={AsQuestionIcon} />
							</Tooltip>
						)}
					</HStack>

					{shouldShowReason && isMobileView && (
						<Text variant="baseStyle" sx={styles.rejectedText}>
							{reasonName}
						</Text>
					)}
				</Flex>
			</Flex>
		</GridItem>
	)
}
