import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<path
		d="M9.98038 1.5L19 10.5M19 10.5L9.98038 19.5M19 10.5L0.5 10.5"
		stroke="currentColor"
	/>
)

const width = '21'
const height = '21'
const viewBox = `0 0 ${width} ${height}`

export const ArrowForwardIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsArrowForwardIcon = createIcon({
	displayName: 'ArrowForwardIcon',
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
