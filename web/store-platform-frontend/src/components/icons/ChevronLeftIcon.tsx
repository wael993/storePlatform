import { Icon, createIcon, type IconProps } from '@chakra-ui/react'
const IconPath = () => (
	<path
		d="M6.5 11L1.5 6L6.5 1"
		stroke="currentColor"
		strokeWidth="1.5"
		strokeLinecap="round"
		strokeLinejoin="round"
		fill="none"
	/>
)

const width = '21'
const height = '13'
const viewBox = `0 0 ${width} ${height}`

export const ChevronLeftIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsChevronLeftIcon = createIcon({
	displayName: 'ChevronLeftIcon',
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
