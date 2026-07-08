import { createIcon, Icon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M8 17H5a1 1 0 01-1-1v-5a2 2 0 012-2h12a2 2 0 012 2v5a1 1 0 01-1 1h-3M8 4h8v5H8V4zm0 11h8v4H8v-4z"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinejoin="round"
			fill="none"
		/>
		<circle cx="7" cy="12" r="1" fill="currentColor" />
	</>
)

const width = '24'
const height = '24'
const viewBox = `0 0 ${width} ${height}`
export const PrintIcon = (props: IconProps) => (
	<Icon
		xmlns="http://www.w3.org/2000/svg"
		viewBox={viewBox}
		fill="none"
		{...props}
	>
		<IconPath />
	</Icon>
)

export const AsPrintIcon = createIcon({
	displayName: 'PrintIcon',
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
