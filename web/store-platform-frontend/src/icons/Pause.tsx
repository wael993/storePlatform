import { createIcon, Icon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<path
		d="M14 9V15M10 9V15M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21Z"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	/>
)

const width = '24'
const height = '24'
const viewBox = `0 0 ${width} ${height}`
export const PauseIcon = (props: IconProps) => (
	<Icon
		xmlns="http://www.w3.org/2000/svg"
		viewBox={viewBox}
		fill="none"
		{...props}
	>
		<IconPath />
	</Icon>
)

export const AsPauseIcon = createIcon({
	displayName: 'PauseIcon',
	path: <IconPath />,
	defaultProps: {
		viewBox: viewBox,
		fill: 'none',
		color: 'currentColor',
		boxSize: 5,
		width: width,
		height: height,
	},
})
