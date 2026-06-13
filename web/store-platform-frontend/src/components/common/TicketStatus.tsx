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

import { AsQuestionIcon } from '../icons/QuestionIcon'
import { TargetType } from '../../shared/globalEnums'
import { compareTargetType } from '../../shared/utils'

interface TicketStatusProps {
	targetType: TargetType
	reasonName?: string
	showReasonName?: boolean
	customStyles?: Partial<Record<'itemTextBold', SystemStyleObject>>
	isMobileView?: boolean
}

export const TicketStatus = ({
	targetType,
	reasonName,
	showReasonName = false,
	customStyles,
	isMobileView = false,
}: TicketStatusProps) => {
	const { t } = useTranslation()
	const { isSupplierTarget } = compareTargetType(targetType)

	const MODAL_STATE_CONFIG: Partial<
		Record<TargetType, { translationKey: string; color: string }>
	> = {
		[TargetType.CUSTOMER]: {
			translationKey: 'زبون',
			color: '#5698E6',
		},
		[TargetType.SUPPLIER]: {
			translationKey: 'مورد',
			color: '#E7CB3A',
		},
		[TargetType.PRODUCT]: {
			translationKey: 'components.activity.states.inExecution',
			color: '#36CE4E',
		},
		[TargetType.DAILY_ACTION]: {
			translationKey: 'components.activity.states.done',
			color: '#C7C7C7',
		},
	}

	const stateInfo = MODAL_STATE_CONFIG[targetType as TargetType] ?? {
		color: '#929494',
		translationKey: t('common.unknownState'),
	}

	const stateTitle: string = stateInfo ? stateInfo.translationKey : ''

	const styles = {
		colorCircle: {
			width: isSupplierTarget ? '0.875rem' : '1.25rem',
			height: isSupplierTarget ? '0.875rem' : '1.25rem',
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
			fontSize: isSupplierTarget && !isMobileView ? '0.875rem' : '1rem',
			fontWeight: isSupplierTarget && !isMobileView ? '500' : '700',
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
			paddingBlock={{
				base: isSupplierTarget ? '0 1rem' : '1rem 0.5rem',
				md: 0,
			}}
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
