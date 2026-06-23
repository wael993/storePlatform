import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M13.78 13.78C12.6922 14.6092 11.3676 15.0685 10 15.0909C5.54545 15.0909 3 9.99997 3 9.99997C3.79157 8.52482 4.88945 7.236 6.22 6.21997M8.66364 5.06179C9.10167 4.95926 9.55013 4.90801 10 4.90907C14.4545 4.90907 17 9.99997 17 9.99997C16.6137 10.7226 16.153 11.403 15.6255 12.03M11.3491 11.3491C11.1743 11.5366 10.9635 11.6871 10.7294 11.7914C10.4952 11.8958 10.2424 11.9519 9.98606 11.9564C9.72972 11.9609 9.4751 11.9138 9.23739 11.8177C8.99967 11.7217 8.78373 11.5788 8.60245 11.3975C8.42116 11.2162 8.27825 11.0003 8.18223 10.7626C8.08622 10.5249 8.03906 10.2703 8.04358 10.0139C8.04811 9.75758 8.10421 9.50478 8.20856 9.2706C8.3129 9.03642 8.46334 8.82566 8.65091 8.65088"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M3 3L17 17"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const WatcherEyeSlashedIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsWatcherEyeSlashedIcon = createIcon({
	displayName: 'WatcherEyeSlashedIcon',
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
