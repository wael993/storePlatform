import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M12.9167 14.6553V3.33378H14.5834V14.6553L16.0775 13.1612L17.256 14.3397L13.7501 17.8456L10.2441 14.3397L11.4227 13.1612L12.9167 14.6553Z"
			fill="currentColor"
		/>
		<path
			d="M7.0834 5.34563L7.0834 16.6671H5.41673L5.41673 5.34563L3.92265 6.83971L2.74414 5.6612L6.25006 2.15527L9.75598 5.6612L8.57747 6.83971L7.0834 5.34563Z"
			fill="currentColor"
		/>
	</>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const SortIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsSortIcon = createIcon({
	displayName: 'SortIcon',
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
