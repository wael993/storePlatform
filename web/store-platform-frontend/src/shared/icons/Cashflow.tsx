import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<g fill="none">
		<path
			id="Vector"
			d="M14.1118 10.2188V12.6632C14.1118 13.4448 12.8007 14.0785 11.1832 14.0785C9.56582 14.0785 8.25468 13.4448 8.25468 12.6632V10.2188"
			stroke="currentColor"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			id="Vector_2"
			d="M14.1118 12.6641V15.1085C14.1118 15.8901 12.8007 16.5238 11.1832 16.5238C9.56582 16.5238 8.25468 15.8901 8.25468 15.1085V12.6641"
			stroke="currentColor"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			id="Vector_3"
			d="M11.1832 11.6393C9.56584 11.6393 8.25468 11.0056 8.25468 10.2239C8.25468 9.44227 9.56584 8.80859 11.1832 8.80859C12.8007 8.80859 14.1118 9.44227 14.1118 10.2239C14.1118 11.0056 12.8007 11.6393 11.1832 11.6393Z"
			stroke="currentColor"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			id="Vector_4"
			d="M6.81226 10.1368C5.37287 10.0477 4.25938 9.45324 4.25938 8.73349V6.28906"
			stroke="currentColor"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			id="Vector_5"
			d="M10.1151 6.28906V7.81909"
			stroke="currentColor"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			id="Vector_6"
			d="M6.81226 12.5821C5.37287 12.4931 4.25938 11.8985 4.25938 11.1788V8.73438"
			stroke="currentColor"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			id="Vector_7"
			d="M6.81226 15.0235C5.37136 14.9345 4.25938 14.34 4.25938 13.6202V11.1758"
			stroke="currentColor"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			id="Vector_8"
			d="M7.18648 7.70571C5.56908 7.70571 4.25791 7.07203 4.25791 6.29035C4.25791 5.50868 5.56908 4.875 7.18648 4.875C8.80389 4.875 10.1151 5.50868 10.1151 6.29035C10.1151 7.07203 8.80389 7.70571 7.18648 7.70571Z"
			stroke="currentColor"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			id="Vector_9"
			d="M4.14661 17.1367L1.36953 16.9946L1.22745 19.7719"
			stroke="currentColor"
			strokeWidth="1.3"
			strokeMiterlimit="10"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			id="Vector_10"
			d="M1.36955 16.9959C3.08937 19.2882 5.77674 20.8293 8.86121 20.9871C11.9457 21.1449 14.7763 19.8861 16.7211 17.7812"
			stroke="currentColor"
			strokeWidth="1.3"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
		<path
			id="Vector_11"
			d="M13.8533 4.86568L16.6304 5.00775L16.7725 2.23047"
			stroke="currentColor"
			strokeWidth="1.3"
			strokeMiterlimit="10"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			id="Vector_12"
			d="M16.6305 5.00481C14.9107 2.71245 12.2233 1.17136 9.13881 1.01356C6.05435 0.855765 3.22373 2.11456 1.27903 4.21793"
			stroke="currentColor"
			strokeWidth="1.3"
			strokeMiterlimit="10"
			strokeLinecap="round"
		/>
	</g>
)

const width = '18'
const height = '22'
const viewBox = `0 0 ${width} ${height}`

export const CashflowIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsCashflowIcon = createIcon({
	displayName: 'CashflowIcon',
	viewBox: viewBox,
	path: <IconPath />,
})
