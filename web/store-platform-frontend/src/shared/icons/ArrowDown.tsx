import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<path
		d="M16.2887 11.9133L10.6637 17.5383C10.5766 17.6257 10.4731 17.695 10.3592 17.7423C10.2452 17.7897 10.1231 17.814 9.99967 17.814C9.87628 17.814 9.75411 17.7897 9.64016 17.7423C9.5262 17.695 9.42271 17.6257 9.33561 17.5383L3.71061 11.9133C3.53449 11.7372 3.43555 11.4983 3.43555 11.2492C3.43555 11.0001 3.53449 10.7613 3.71061 10.5852C3.88673 10.409 4.1256 10.3101 4.37467 10.3101C4.62374 10.3101 4.86262 10.409 5.03874 10.5852L9.06295 14.6094V3.125C9.06295 2.87636 9.16173 2.6379 9.33754 2.46209C9.51336 2.28627 9.75181 2.1875 10.0005 2.1875C10.2491 2.1875 10.4876 2.28627 10.6634 2.46209C10.8392 2.6379 10.938 2.87636 10.938 3.125V14.6094L14.9622 10.5844C15.1383 10.4083 15.3772 10.3093 15.6262 10.3093C15.8753 10.3093 16.1142 10.4083 16.2903 10.5844C16.4664 10.7605 16.5654 10.9994 16.5654 11.2484C16.5654 11.4975 16.4664 11.7364 16.2903 11.9125L16.2887 11.9133Z"
		fill="currentColor"
	/>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const ArrowDownIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsArrowDownIcon = createIcon({
	displayName: 'ArrowDownIcon',
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
