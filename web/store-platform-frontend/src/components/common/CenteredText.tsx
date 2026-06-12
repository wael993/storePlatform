import { Box, Center, SystemCSSProperties, Text } from '@chakra-ui/react'

const styles = {
	text: {
		color: '#6F6F6F',
		fontWeight: '700',
	},
}

const CenteredText = ({
	text,
	customStyles,
}: {
	text: string
	customStyles?: SystemCSSProperties
}) => {
	return (
		<Box>
			<Center>
				<Text sx={{ ...styles.text, ...customStyles }}>{text}</Text>
			</Center>
		</Box>
	)
}

export default CenteredText
