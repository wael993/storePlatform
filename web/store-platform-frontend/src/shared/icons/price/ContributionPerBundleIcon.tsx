import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M17.2305 9.73047V13.3268C17.2305 14.477 15.3063 15.4082 12.9321 15.4082C10.5579 15.4082 8.63372 14.4756 8.63372 13.3268V9.73047"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M17.2305 13.3242V16.9206C17.2305 18.0707 15.3063 19.002 12.9321 19.002C10.5579 19.002 8.63372 18.0694 8.63372 16.9206V13.3242"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M12.9321 11.8112C10.5582 11.8112 8.63372 10.8794 8.63372 9.72984C8.63372 8.58031 10.5582 7.64844 12.9321 7.64844C15.306 7.64844 17.2305 8.58031 17.2305 9.72984C17.2305 10.8794 15.306 11.8112 12.9321 11.8112Z"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M6.51562 8.74777C4.40217 8.61644 2.76778 7.74222 2.76778 6.68229V3.08594"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M11.3633 3.08594V5.69644"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M6.51562 12.3415C4.40217 12.2102 2.76778 11.336 2.76778 10.276V6.67969"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M6.51562 15.9353C4.40085 15.8039 2.76646 14.9297 2.76646 13.8698V10.2734"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M7.06491 5.1628C4.69098 5.1628 2.76653 4.23093 2.76653 3.0814C2.76653 1.93187 4.69098 1 7.06491 1C9.43883 1 11.3633 1.93187 11.3633 3.0814C11.3633 4.23093 9.43883 5.1628 7.06491 5.1628Z"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
	</>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const ContributionPerBundleIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsContributionPerBundleIcon = createIcon({
	displayName: 'ContributionPerBundleIcon',
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
