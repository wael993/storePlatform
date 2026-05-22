import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M14.5008 7.00083C14.5008 5.80714 14.0266 4.66235 13.1825 3.81828C12.3385 2.97422 11.1937 2.50003 10 2.50003C8.80631 2.50003 7.66152 2.97422 6.81745 3.81828C5.97339 4.66235 5.4992 5.80714 5.4992 7.00083C5.4992 12.2518 3.2488 13.752 3.2488 13.752H16.7512C16.7512 13.752 14.5008 12.2518 14.5008 7.00083Z"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M11.2976 16.7525C11.1657 16.9799 10.9764 17.1686 10.7487 17.2997C10.5209 17.4309 10.2627 17.5 9.99987 17.5C9.73704 17.5 9.47882 17.4309 9.25107 17.2997C9.02332 17.1686 8.83402 16.9799 8.70214 16.7525"
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

export const BellIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsBellIcon = createIcon({
	displayName: 'AsBellIcon',
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
