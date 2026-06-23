import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<path d="M11.0196 21L2 12M2 12L11.0196 3M2 12L25 12" stroke="currentColor" />
)

const width = '24'
const height = '24'
const viewBox = `0 0 ${width} ${height}`

export const ArrowBackIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsArrowBackIcon = createIcon({
	displayName: 'ArrowBackIcon',
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
