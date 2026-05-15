import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M10.2002 18.1818H4.39979C3.51979 18.1818 2.79979 17.4454 2.79979 16.5454V5.09085C2.79979 4.19085 3.51979 3.45448 4.39979 3.45448H15.5998C16.4798 3.45448 17.1998 4.19085 17.1998 5.09085V10"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M13.2002 1.81825V5.09098"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M6.7998 1.81825V5.09098"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M2.79979 8.36366H17.1998"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M13.8398 18.1817L17.1998 14.7453L13.8398 11.309"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M17.2002 14.7455H9.13623"
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

export const StartDateIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsStartDateIcon = createIcon({
	displayName: 'StartDateIcon',
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
