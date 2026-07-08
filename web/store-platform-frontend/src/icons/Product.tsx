import { createIcon, Icon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<rect x="0" y="0" width="24" height="24" fill="none" />
		<path
			fill="currentColor"
			d="M22 3H2v6h1v11c0 1.105.895 2 2 2h14c1.105 0 2-.895 2-2V9h1V3zM4 5h16v2H4V5zm15 15H5V9h14v11zM9 11h6c0 1.105-.895 2-2 2h-2c-1.105 0-2-.895-2-2z"
		/>
	</>
)

const width = '24'
const height = '24'
const viewBox = `0 0 ${width} ${height}`

export const ProductIcon = (props: IconProps) => (
	<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
		<IconPath />
	</Icon>
)

export const AsProductIcon = createIcon({
	displayName: 'ProductIcon',
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
