import {
	Flex,
	Icon,
	IconButton,
	Link,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverTrigger,
	Portal,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { ThreeDotsIcon } from '../../icons/ThreeDots'
import { AsEmptyCheckmarkCircleIcon } from '../icons/EmptyCheckmarkCircle'

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
	action: {
		width: '100%',
		padding: '1rem',
		cursor: 'pointer',
		color: '#939596',
		fontSize: '0.875rem',
		fontWeight: 700,
		lineHeight: '1.2rem',
		textAlign: 'start',
	},
}

interface OptionsPopoverProps {
	onPrintBarcode?: () => void
	isPrintLoading?: boolean
}

const OptionsPopover = ({
	onPrintBarcode,
	isPrintLoading,
}: OptionsPopoverProps) => {
	const { t } = useTranslation()
	const { isOpen, onOpen, onClose } = useDisclosure()

	return (
		<Popover
			returnFocusOnClose={false}
			isOpen={isOpen}
			onOpen={onOpen}
			onClose={onClose}
		>
			<PopoverTrigger>
				<IconButton
					sx={styles.iconButton}
					aria-label={t('common.listOptions')}
					icon={<ThreeDotsIcon />}
					isDisabled={isPrintLoading}
					onClick={e => {
						onOpen()
						e.stopPropagation()
					}}
				/>
			</PopoverTrigger>
			<Portal>
				<PopoverContent width="10rem">
					<PopoverBody p={0}>
						{onPrintBarcode ? (
							<Text
								as="button"
								type="button"
								sx={styles.action}
								onMouseDown={event => {
									event.preventDefault()
									event.stopPropagation()
								}}
								onClick={event => {
									event.preventDefault()
									event.stopPropagation()
									onPrintBarcode()
									onClose()
								}}
							>
								{t('components.product.printBarcode')}
							</Text>
						) : (
							<Flex sx={styles.columnFlexWrapper}>
								<Link target="_blank">
									<Flex cursor="pointer" gap="1rem">
										<Icon
											as={AsEmptyCheckmarkCircleIcon}
											boxSize={5}
											color="#939596"
										/>
										<Text sx={styles.actionText} noOfLines={1}>
											TO_DO
										</Text>
									</Flex>
								</Link>
							</Flex>
						)}
					</PopoverBody>
				</PopoverContent>
			</Portal>
		</Popover>
	)
}

export default OptionsPopover
