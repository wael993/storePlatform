import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M16.6667 17.5V15.8333C16.6667 14.9492 16.3155 14.1014 15.6904 13.4763C15.0652 12.8512 14.2174 12.5 13.3333 12.5H6.66668C5.78262 12.5 4.93478 12.8512 4.30965 13.4763C3.68453 14.1014 3.33334 14.9492 3.33334 15.8333V17.5"
			stroke="currentColor"
			fill="none"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M10.0001 9.16668C11.8411 9.16668 13.3334 7.6743 13.3334 5.83335C13.3334 3.9924 11.8411 2.50002 10.0001 2.50002C8.15916 2.50002 6.66678 3.9924 6.66678 5.83335C6.66678 7.6743 8.15916 9.16668 10.0001 9.16668Z"
			stroke="currentColor"
			fill="none"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const PersonIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsPersonIcon = createIcon({
	displayName: 'PersonIcon',
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
