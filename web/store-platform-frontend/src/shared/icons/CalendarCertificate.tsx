import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M14.9998 9.375C16.4956 9.375 17.7082 10.5833 17.7082 12.0833C17.7082 13.5833 16.4998 14.7917 14.9998 14.7917C13.4998 14.7917 12.2915 13.5791 12.2915 12.0833"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
		/>
		<path
			d="M13.125 14.083V17.7497C13.125 18.083 13.5 18.2913 13.7917 18.083L15 17.2497L16.2083 18.083C16.5 18.2497 16.875 18.083 16.875 17.7497V14.083"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M10 15.2087H3.5415C2.83317 15.2087 2.2915 14.667 2.2915 13.9587V4.79199C2.2915 4.08366 2.83317 3.54199 3.5415 3.54199H16.4582C17.1665 3.54199 17.7082 4.08366 17.7082 4.79199V7.50037"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M3.1665 8H10.1665"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
		/>
		<path
			d="M7 1.77148V5.31152"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
		/>
		<path
			d="M13 1.77148V5.31152"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
		/>
	</>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const CalendarCertificateIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsCalendarCertificateIcon = createIcon({
	displayName: 'CalendarCertificateIcon',
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
