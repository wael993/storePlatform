import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M11 20.5L11 14.5"
			fill="currentColor"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M11 14.8571C11 14.8571 11.75 14.2143 14 14.2143C16.25 14.2143 17.75 15.5 20 15.5C22.25 15.5 23 14.8571 23 14.8571V7.14286C23 7.14286 22.25 7.78571 20 7.78571C17.75 7.78571 16.25 6.5 14 6.5C11.75 6.5 11 7.14286 11 7.14286V14.8571Z"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</>
)

const width = '34'
const height = '27'
const viewBox = `0 0 ${width} ${height}`

export const ActiveFlagIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsActiveFlagIcon = createIcon({
	displayName: 'ActiveFlagIcon',
	viewBox: viewBox,
	path: (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={width}
			height={height}
			viewBox={viewBox}
		>
			<IconPath />
		</svg>
	),
})
