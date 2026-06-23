import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<path
		d="M11.8636 3.5H17.5M17.5 3.5V9.13636M17.5 3.5L9.5 11.5M7.04545 3.5H5.5C4.39543 3.5 3.5 4.39543 3.5 5.5V15.5C3.5 16.6046 4.39543 17.5 5.5 17.5H15.5C16.6046 17.5 17.5 16.6046 17.5 15.5V13.9545"
		stroke="currentColor"
		strokeWidth="1.5"
		strokeLinecap="round"
		strokeLinejoin="round"
	/>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const ShareIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsShareIcon = createIcon({
	displayName: 'ShareIcon',
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
