import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M7.75869 18.1799H4.27402C3.37423 18.1799 2.63803 17.4437 2.63803 16.5439V5.09199C2.63803 4.19219 3.37423 3.45599 4.27402 3.45599H15.726C16.6258 3.45599 17.362 4.19219 17.362 5.09199V11.5214"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M13.272 1.82V5.09198"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M6.728 1.82V5.09198"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M2.63803 8.36397H17.362"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M12.5521 11.3088L9.11649 14.7444L12.5521 18.18"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M9.11649 14.7442H17.3619"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const EndDateIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsEndDateIcon = createIcon({
	displayName: 'EndDateIcon',
	viewBox: viewBox,
	path: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={width}
			height={height}
			viewBox={viewBox}
			fill="none"
		>
			<IconPath />
		</svg>
	),
})
