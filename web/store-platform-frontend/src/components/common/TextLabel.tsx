import { VStack } from '@chakra-ui/react'
import { CustomTooltip } from './CustomTooltip'

const styles: StylesObject = {
	mainContainer: {
		alignItems: 'flex-start',
		gap: '0',
		display: 'block',
		paddingX: '1rem',
	},
	labelWrapper: {
		color: '#747474',
		fontSize: '0.9rem',
		fontWeight: 700,
		width: '100%',
	},
	textWrapper: {
		fontWeight: '700',
		width: '100%',
	},
}

interface TextLabelProps {
	label: string
	value?: string
}

const TextLabel = ({ label, value }: TextLabelProps) => {
	return (
		<VStack sx={styles.mainContainer}>
			<CustomTooltip styles={styles.labelWrapper} label={label}>
				{label}
			</CustomTooltip>

			<CustomTooltip styles={styles.textWrapper} label={value}>
				{value}
			</CustomTooltip>
		</VStack>
	)
}

export default TextLabel
