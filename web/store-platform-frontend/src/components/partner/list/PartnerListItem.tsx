import {
	Td,
	Checkbox,
	Flex,
	Text,
	Skeleton,
	useDisclosure,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import ConfirmationDialog from '../../ConfirmationDialog'
import { useDeletePartnerMutation } from '../../../api/apiStore'
import useCustomToast from '../../common/CustomToast'
import { useSee } from '../../../shared/hooks/useSee'
import { SEE } from '../../../shared/seeFlags'
import { PARTNER_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import { listStyles } from '../../../shared/styles'
import { formatDate } from '../../../shared/dateUtils'
import OptionsPopover from '../../modals/OptionsPopover'
import NotificationCircle from '../../NotificationCircle'
import StateCircle from '../../StateCircle'

const styles = {
	tableRow: {
		padding: 0,
		height: 0,
		'@-moz-document url-prefix()': {
			height: '100%',
		},
	},
	checkboxRow: {
		left: '0',
		position: 'sticky',
		zIndex: 1,
		backgroundColor: '#FFFFFF',
	},
	cellContentWrapper: {
		...listStyles.tableCell,
		height: '100%',
		width: '100%',
		alignItems: 'center',
		justifyContent: 'start',
	},
	rightStickyContainerContent: {
		gap: '1rem',
		alignItems: 'center',
		justifyContent: 'flex-end',
		width: '14rem',
	},
	cellContentWrapperSticky: {
		height: '100%',
		alignItems: 'center',
		justifyContent: 'start',
	},
	checkboxWrapper: {
		padding: 0,
	},
	text: {
		...listStyles.tableCellText,
	},
	rightStickyContainer: {
		width: `${PARTNER_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem`,
		position: 'sticky',
		right: '0',
		zIndex: '1',
		background: `linear-gradient(to right, transparent 0rem, transparent 0rem, #FFFFFF 7rem, #FFFFFF 2rem, #FFFFFF ${PARTNER_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem)`,
	},
	topSectionMenu: {
		boxSize: 7,
		bg: 'transparent',
		fontSize: 'xl',
		color: '#1E1E1E',
		...hoverFocusActiveButtonStyles,
	},
	actionItem: {
		py: '0.875rem',
		alignItems: 'center',
		cursor: 'pointer',
	},
	skeletonText: {
		width: '13rem',
		height: '1.5rem',
	},
	icon: {
		fontSize: '1.5rem',
		color: '#929494',
	},
} satisfies StylesObject

interface PartnerListItemProps {
	partner: Partner
	onSelect: (id: string) => void
	isSelected: boolean
	isHovered: boolean
	isLoading: boolean
}

const PartnerListItem = ({
	partner,
	onSelect,
	isSelected,
	isHovered,
	isLoading,
}: PartnerListItemProps) => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const canDelete = canSee(SEE.partnersDelete)
	const showCheckbox = canDelete
	const isReadyForExecution = false
	const showToast = useCustomToast()
	const {
		isOpen: isDeleteOpen,
		onOpen: onDeleteOpen,
		onClose: onDeleteClose,
	} = useDisclosure()
	const [deletePartner, { isLoading: isDeleting }] = useDeletePartnerMutation()

	return (
		<>
			{showCheckbox && (
				<Td
					sx={{
						...styles.tableRow,
						...styles.checkboxRow,

						backgroundColor: isHovered ? '#F4F4F4' : '#FFFFFF',
					}}
				>
					<Flex
						sx={{
							...styles.cellContentWrapper,
							...styles.checkboxWrapper,

							backgroundColor: isHovered ? '#F4F4F4' : '#FFFFFF',
						}}
						onClick={e => {
							onSelect(partner.partnerId)

							e.stopPropagation()
						}}
						cursor={'pointer'}
					>
						<Skeleton isLoaded={!isLoading}>
							<Checkbox
								pointerEvents={'none'}
								isChecked={isSelected}
								zIndex={2}
								padding={4}
							/>
						</Skeleton>
					</Flex>
				</Td>
			)}
			<Td sx={styles.tableRow}>
				<Flex sx={styles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text
							sx={{
								...styles.text,
								fontWeight: 500,
								color:
									isReadyForExecution && !isHovered ? '#B2B2B2' : '#1E1E1E',
							}}
						>
							{partner.name}
						</Text>
					</Skeleton>
				</Flex>
			</Td>
			<Td sx={styles.tableRow}>
				<Flex sx={styles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text sx={{ ...styles.text, fontWeight: 500 }}>
							{partner.internalCode}
						</Text>
					</Skeleton>
				</Flex>
			</Td>

			<Td sx={styles.tableRow}>
				<Flex
					sx={{
						...styles.cellContentWrapper,
						flexDirection: 'column',
						justifyContent: 'center',
						alignItems: 'start',
					}}
				>
					<Skeleton isLoaded={!isLoading}>
						<Text sx={styles.text}>
							{partner.createdAt ? formatDate(new Date(partner.createdAt)) : ''}
						</Text>
						<Text sx={styles.text}>
							{partner.createdAt ? formatDate(new Date(partner.createdAt)) : ''}
						</Text>
					</Skeleton>
				</Flex>
			</Td>

			<Td sx={{ ...styles.tableRow, ...styles.rightStickyContainer, right: 1 }}>
				<Flex sx={styles.rightStickyContainerContent}>
					{/* Notification Circle & State Circle */}
					<Flex sx={styles.cellContentWrapperSticky}>
						<Skeleton isLoaded={!isLoading}>
							<NotificationCircle
								productId={partner.partnerId}
								showIfNoChanges={true}
								customStyles={{
									animationCircle: { width: '1.5rem', height: '1.5rem' },
								}}
							>
								<StateCircle
									stateColor={'#929494'}
									stateTitle={'inactive'}
									customStyles={{
										colorCircle: { width: '0.875rem', height: '0.875rem' },
									}}
								/>
							</NotificationCircle>
						</Skeleton>
					</Flex>
					<Flex sx={styles.cellContentWrapperSticky}>
						<Skeleton isLoaded={!isLoading}>
							{canDelete ? (
								<OptionsPopover
									onDelete={onDeleteOpen}
									deleteLabel={t('partner.deletePartner')}
								/>
							) : null}
						</Skeleton>
					</Flex>
				</Flex>
			</Td>
			<ConfirmationDialog
				header={t('partner.deletePartner')}
				body={t('partner.deletePartnerConfirm')}
				isOpen={isDeleteOpen}
				onClose={onDeleteClose}
				onConfirm={async () => {
					try {
						await deletePartner(partner.partnerId).unwrap()
						onDeleteClose()
						showToast({
							status: 'success',
							description: t('partner.deletePartnerSuccess'),
						})
					} catch (error) {
						const err = error as { data?: { message?: string } }

						showToast({
							status: 'error',
							description: err.data?.message || t('partner.deletePartnerError'),
						})
					}
				}}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeleting}
			/>
		</>
	)
}

export default PartnerListItem
