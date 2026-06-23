import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M13.4444 1.5H2.55556C1.69645 1.5 1 2.19645 1 3.05556V13.9444C1 14.8036 1.69645 15.5 2.55556 15.5H13.4444C14.3036 15.5 15 14.8036 15 13.9444V3.05556C15 2.19645 14.3036 1.5 13.4444 1.5Z"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			fill="none"
		/>
		<path
			d="M5.27799 6.94448C5.92233 6.94448 6.44466 6.42214 6.44466 5.77781C6.44466 5.13348 5.92233 4.61115 5.27799 4.61115C4.63366 4.61115 4.11133 5.13348 4.11133 5.77781C4.11133 6.42214 4.63366 6.94448 5.27799 6.94448Z"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			fill="none"
		/>
		<path
			d="M14.9996 10.8334L11.1107 6.94449L2.55518 15.5"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			fill="none"
		/>
	</>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const ImageUploadIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsImageUploadIcon = createIcon({
	displayName: 'ImageUploadIcon',
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
