import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<path
		d="M4.14015 1.81884L15.3429 1.92976M15.3429 1.92976L15.4539 13.1325M15.3429 1.92976L1.2008 16.0719"
		stroke="black"
		strokeWidth="2"
	/>
)

const width = '17'
const height = '17'
const viewBox = `0 0 ${width} ${height}`

export const Rotated45RightArrow = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsRotated45RightArrow = createIcon({
	displayName: 'Rotated45RightArrow',
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
