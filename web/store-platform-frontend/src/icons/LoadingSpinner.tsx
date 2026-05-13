import { Flex, Spinner, SpinnerProps } from '@chakra-ui/react'

const deFaultStyles: StylesObject = {
	flexWrapper: {
		alignItems: 'center',
		justifyContent: 'center',
		width: '100%',
		marginTop: '3rem',
		marginBottom: '0',
	},
}

type LoadingSpinnerProps = {
	size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
	marginTop?: string
	marginBottom?: string
} & Omit<SpinnerProps, 'size'>

const LoadingSpinner = ({
	size = 'md',
	marginTop,
	marginBottom,
	...rest
}: LoadingSpinnerProps) => {
	const styles: StylesObject = {
		flexWrapper: {
			...deFaultStyles.flexWrapper,
			marginTop: marginTop ? marginTop : deFaultStyles.flexWrapper.marginTop,
			marginBottom: marginBottom
				? marginBottom
				: deFaultStyles.flexWrapper.marginBottom,
		},
	}

	return (
		<Flex sx={styles.flexWrapper}>
			<Spinner size={size} {...rest} />
		</Flex>
	)
}

export default LoadingSpinner
