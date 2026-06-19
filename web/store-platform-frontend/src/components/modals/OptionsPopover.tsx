import {
	Flex,
	Icon,
	Popover,
	IconButton,
	PopoverTrigger,
	PopoverContent,
	PopoverBody,
	useDisclosure,
	Text,
	Link,
	Portal,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { ThreeDotsIcon } from '../../icons/ThreeDots'
import { AsEmptyCheckmarkCircleIcon } from '../icons/EmptyCheckmarkCircle'
// import { ThreeDotsIcon } from '../../../icons/ThreeDots'
// import { hoverFocusActiveButtonStyles } from '../../../../theme'
// import { ListOffer } from './OfferListWithActionBar'
// import { LiaExternalLinkAltSolid } from 'react-icons/lia'
// import { useSettings } from '../../../../shared/hooks/useSettings'
// import { getPPCEventLink } from '../../../../shared/utils'

const styles: StylesObject = {
	iconButton: {
		boxSize: 6,
		bg: 'transparent',
		fontSize: 'xl',
		color: '#353535',
		...hoverFocusActiveButtonStyles,
	},
	columnFlexWrapper: {
		width: '100%',
		padding: '1rem',
		borderBottom: '1px solid #ECECEC',
		gap: '1rem',
		flexDir: 'column',
	},
	actionText: {
		color: '#939596',
		fontSize: '0.875rem',
		fontWeight: 700,
		lineHeight: '1.2rem',
	},
}
interface OptionsPopoverProps {
	offer: string | undefined
}
const OptionsPopover = (_offer: OptionsPopoverProps) => {
	const { t } = useTranslation()
	const {
		isOpen: isPopoverOpen,
		onOpen: onPopoverOpen,
		onClose: onPopoverClose,
	} = useDisclosure()

	return (
		<Popover
			returnFocusOnClose={false}
			isOpen={isPopoverOpen}
			onOpen={onPopoverOpen}
			onClose={onPopoverClose}
		>
			<PopoverTrigger>
				<IconButton
					sx={styles.iconButton}
					aria-label={t('common.listOptions')}
					icon={<ThreeDotsIcon />}
					onClick={e => {
						onPopoverOpen()
						e.stopPropagation()
					}}
				/>
			</PopoverTrigger>
			<Portal>
				<PopoverContent width={'10rem'}>
					<PopoverBody p={0}>
						<Flex flexDir={'column'}>
							<Flex sx={styles.columnFlexWrapper}>
								<Link
									// href={getPPCEventLink({
									// 	eventId: offer.eventId,
									// 	blockId: offer.blockId,
									// 	pageNumber: offer.pageNumber,
									// 	ppcUrl,
									// })}
									target="_blank"
								>
									<Flex cursor={'pointer'} gap={'1rem'}>
										<Icon
											as={AsEmptyCheckmarkCircleIcon}
											boxSize={5}
											color={'#939596'}
										/>
										<Text sx={styles.actionText} noOfLines={1}>
											TO_DO
										</Text>
									</Flex>
								</Link>
							</Flex>
						</Flex>
					</PopoverBody>
				</PopoverContent>
			</Portal>
		</Popover>
	)
}

export default OptionsPopover
