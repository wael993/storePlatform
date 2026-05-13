import { Center } from '@chakra-ui/react'
import LoadingSpinner from './LoadingSpinner'

const styles = {
	centerWrapper: {
		width: '100%',
		height: '100%',
	},
} satisfies StylesObject

const FullSizeLoadingSpinner = () => {
	return (
		<Center sx={styles.centerWrapper}>
			<LoadingSpinner size="lg" />
		</Center>
	)
}

export default FullSizeLoadingSpinner
