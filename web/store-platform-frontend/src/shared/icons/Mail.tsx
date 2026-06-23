import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M3.33325 4.16667C2.87682 4.16667 2.49992 4.54357 2.49992 5V15C2.49992 15.4564 2.87682 15.8333 3.33325 15.8333H16.6666C17.123 15.8333 17.4999 15.4564 17.4999 15V5C17.4999 4.54357 17.123 4.16667 16.6666 4.16667H3.33325ZM0.833252 5C0.833252 3.6231 1.95635 2.5 3.33325 2.5H16.6666C18.0435 2.5 19.1666 3.6231 19.1666 5V15C19.1666 16.3769 18.0435 17.5 16.6666 17.5H3.33325C1.95635 17.5 0.833252 16.3769 0.833252 15V5Z"
			fill="currentColor"
		/>
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M0.983964 4.52251C1.24789 4.14547 1.7675 4.05378 2.14454 4.3177L9.99999 9.81652L17.8554 4.3177C18.2325 4.05378 18.7521 4.14547 19.016 4.52251C19.2799 4.89955 19.1882 5.41916 18.8112 5.68309L10.4779 11.5164C10.1909 11.7173 9.80904 11.7173 9.52211 11.5164L1.18877 5.68309C0.81173 5.41916 0.720035 4.89955 0.983964 4.52251Z"
			fill="currentColor"
		/>
	</>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const MailIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsMailIcon = createIcon({
	displayName: 'MailIcon',
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
