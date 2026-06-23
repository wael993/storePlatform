import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M14.5753 9.33212L9.33943 14.568C9.20378 14.7038 9.04271 14.8115 8.86541 14.885C8.68811 14.9585 8.49806 14.9963 8.30613 14.9963C8.11419 14.9963 7.92414 14.9585 7.74684 14.885C7.56954 14.8115 7.40847 14.7038 7.27283 14.568L1 8.30247V1H8.30247L14.5753 7.27283C14.8473 7.54647 15 7.91663 15 8.30247C15 8.68832 14.8473 9.05848 14.5753 9.33212Z"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M4.65234 4.65234H4.65965"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</>
)

const width = '16'
const height = '16'
const viewBox = `0 0 ${width} ${height}`

export const PriceActivityFeeIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsPriceActivityFeeIcon = createIcon({
	displayName: 'PriceActivityFeeIcon',
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
