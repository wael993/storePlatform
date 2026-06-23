import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<path
		d="M9.19216 7.02764C9.00591 7.215 8.90137 7.46845 8.90137 7.73264C8.90137 7.99683 9.00591 8.25028 9.19216 8.43764L12.7322 12.0276L9.19216 15.5676C9.00591 15.755 8.90137 16.0085 8.90137 16.2726C8.90137 16.5368 9.00591 16.7903 9.19216 16.9776C9.28512 17.0714 9.39572 17.1458 9.51758 17.1965C9.63944 17.2473 9.77015 17.2734 9.90216 17.2734C10.0342 17.2734 10.1649 17.2473 10.2867 17.1965C10.4086 17.1458 10.5192 17.0714 10.6122 16.9776L14.8522 12.7376C14.9459 12.6447 15.0203 12.5341 15.0711 12.4122C15.1218 12.2904 15.148 12.1597 15.148 12.0276C15.148 11.8956 15.1218 11.7649 15.0711 11.6431C15.0203 11.5212 14.9459 11.4106 14.8522 11.3176L10.6122 7.02764C10.5192 6.93391 10.4086 6.85952 10.2867 6.80875C10.1649 6.75798 10.0342 6.73184 9.90216 6.73184C9.77015 6.73184 9.63944 6.75798 9.51758 6.80875C9.39572 6.85952 9.28512 6.93391 9.19216 7.02764Z"
		fill="currentColor"
	/>
)

const width = '24'
const height = '24'
const viewBox = `0 0 ${width} ${height}`

export const ChevronRightIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsChevronRightIcon = createIcon({
	displayName: 'ChevronRightIcon',
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
