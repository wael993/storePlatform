import {
	IconButton,
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

const styles: StylesObject = {
	iconButton: {
		boxSize: 6,
		bg: 'transparent',
		fontSize: 'xl',
		color: '#353535',
		...hoverFocusActiveButtonStyles,
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
	onEdit?: () => void
	onPrintBarcode?: () => void
	isPrintLoading?: boolean
	onDelete?: () => void
	deleteLabel?: string
}

const OptionsPopover = ({
	onEdit,
	onPrintBarcode,
	isPrintLoading,
	onDelete,
	deleteLabel,
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
						{onEdit ? (
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
									onEdit()
									onClose()
								}}
							>
								{t('components.product.editProduct')}
							</Text>
						) : null}
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
						) : null}
						{onDelete ? (
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
									onDelete()
									onClose()
								}}
							>
								{deleteLabel ?? t('components.product.deleteProduct')}
							</Text>
						) : null}
					</PopoverBody>
				</PopoverContent>
			</Portal>
		</Popover>
	)
}

export default OptionsPopover
