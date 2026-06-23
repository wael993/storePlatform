import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<circle cx="3" cy="3" r="1.5" fill="currentColor" />
		<circle cx="9" cy="3" r="1.5" fill="currentColor" />
		<circle cx="3" cy="8" r="1.5" fill="currentColor" />
		<circle cx="9" cy="8" r="1.5" fill="currentColor" />
		<circle cx="3" cy="13" r="1.5" fill="currentColor" />
		<circle cx="9" cy="13" r="1.5" fill="currentColor" />
	</>
)

const width = '12'
const height = '16'
const viewBox = `0 0 ${width} ${height}`

export const DragGripIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsDragGripIcon = createIcon({
	displayName: 'DragGripIcon',
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
