import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M18 8.5V8.35417C18 6.50171 16.4983 5 14.6458 5H9.5C7.567 5 6 6.567 6 8.5C6 10.433 7.567 12 9.5 12H14.5C16.433 12 18 13.567 18 15.5C18 17.433 16.433 19 14.5 19H9.42708C7.53436 19 6 17.4656 6 15.5729V15.5M12 3V21"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</>
)

const width = '24'
const height = '24'
const viewBox = `0 0 ${width} ${height}`

export const DollarSignIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsDollarSignIcon = createIcon({
	displayName: 'AsDollarSignIcon',
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
