import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<g fill="none">
		<path
			d="M15.2324 9.73047V13.3268C15.2324 14.477 13.3082 15.4082 10.934 15.4082C8.55982 15.4082 6.63561 14.4756 6.63561 13.3268V9.73047"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M15.2324 13.3242V16.9206C15.2324 18.0707 13.3082 19.002 10.934 19.002C8.55982 19.002 6.63561 18.0694 6.63561 16.9206V13.3242"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M10.934 11.8112C8.56006 11.8112 6.63561 10.8794 6.63561 9.72984C6.63561 8.58031 8.56006 7.64844 10.934 7.64844C13.3079 7.64844 15.2324 8.58031 15.2324 9.72984C15.2324 10.8794 13.3079 11.8112 10.934 11.8112Z"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M4.51556 8.74777C2.40211 8.61644 0.767722 7.74222 0.767722 6.68229V3.08594"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M9.36578 3.08594V5.69644"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M4.51556 12.3415C2.40211 12.2102 0.767722 11.336 0.767722 10.276V6.67969"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M4.51685 15.9353C2.40207 15.8039 0.767679 14.9297 0.767679 13.8698V10.2734"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			d="M5.06741 5.1628C2.69349 5.1628 0.769037 4.23093 0.769037 3.0814C0.769037 1.93187 2.69349 1 5.06741 1C7.44134 1 9.36578 1.93187 9.36578 3.0814C9.36578 4.23093 7.44134 5.1628 5.06741 5.1628Z"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
	</g>
)

const width = '16'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const RentIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsRentIcon = createIcon({
	displayName: 'RentIcon',
	viewBox: viewBox,
	path: <IconPath />,
})
