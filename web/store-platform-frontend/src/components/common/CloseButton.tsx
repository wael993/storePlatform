import { Flex, Icon } from '@chakra-ui/react'
import { AsCloseIcon } from '../icons/Close'

const styles = {
	closeButtonWrapper: {
		cursor: 'pointer',
		alignItems: 'center',
	},
	actionIcon: {
		color: '#1E1E1E',
		cursor: 'pointer',
	},
} satisfies StylesObject

interface CloseButtonProps {
	onClose: () => void
}

export const CloseButton = ({ onClose }: CloseButtonProps) => {
	return (
		<Flex sx={styles.closeButtonWrapper}>
			<Icon
				sx={styles.actionIcon}
				as={AsCloseIcon}
				onClick={onClose}
				boxSize={8}
			/>
		</Flex>
	)
}
