import { Icon, createIcon, type IconProps } from '@chakra-ui/react'
const IconPath = () => (
	<path
		d="M4.16699 1.66797C2.78628 1.66797 1.66699 2.78726 1.66699 4.16797V15.8346C1.66699 17.2153 2.78628 18.3346 4.16699 18.3346H15.8337C17.2144 18.3346 18.3337 17.2153 18.3337 15.8346V4.16797C18.3337 2.78726 17.2144 1.66797 15.8337 1.66797H4.16699ZM3.33366 4.51315V8.82279L11.1788 16.668H15.4885L3.33366 4.51315ZM16.667 15.4895V11.1798L8.82182 3.33464H4.51217L16.667 15.4895ZM11.1788 3.33464L16.667 8.82279V4.16797C16.667 3.70773 16.2939 3.33464 15.8337 3.33464H11.1788ZM8.82181 16.668L3.33366 11.1798V15.8346C3.33366 16.2949 3.70675 16.668 4.16699 16.668H8.82181Z"
		fill="currentColor"
		fillRule="evenodd"
	/>
)
const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const VacantAdvertising = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}
export const AsVacantAdvertising = createIcon({
	displayName: 'VacantAdvertising',
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
