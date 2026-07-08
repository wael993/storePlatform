import { Icon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M3 7.5C3 6.67157 3.67157 6 4.5 6H18.5C19.8807 6 21 7.11929 21 8.5V17.5C21 18.8807 19.8807 20 18.5 20H5.5C4.11929 20 3 18.8807 3 17.5V7.5Z"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M16 13H21"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<circle cx="17.5" cy="13" r="0.5" fill="currentColor" />
		<path
			d="M6 6V5.5C6 4.67157 6.67157 4 7.5 4H17"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</>
)

export const WalletIcon = (props: IconProps) => (
	<Icon
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		{...props}
	>
		<IconPath />
	</Icon>
)
