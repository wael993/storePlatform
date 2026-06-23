import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<path
		d="M18.3333 2.5H1.66666L8.33332 10.3833V15.8333L11.6667 17.5V10.3833L18.3333 2.5Z"
		stroke="currentColor"
		strokeWidth="1.5"
		strokeLinecap="round"
		strokeLinejoin="round"
	/>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const FilterIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsFilterIcon = createIcon({
	displayName: 'FilterIcon',
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
