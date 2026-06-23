import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M11.2586 16.5449C11.1307 16.7653 10.9472 16.9483 10.7264 17.0755C10.5055 17.2027 10.2552 17.2696 10.0004 17.2696C9.74555 17.2696 9.4952 17.2027 9.27439 17.0755C9.05357 16.9483 8.87005 16.7653 8.74219 16.5449"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M14.8192 10.7282C14.4957 9.54373 14.3414 8.31947 14.361 7.0918"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M5.82403 5.82617C5.69768 6.23607 5.63393 6.6627 5.63494 7.09163C5.63494 12.1825 3.45312 13.6371 3.45312 13.6371H13.6349"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M14.3636 7.09081C14.3648 6.30032 14.1512 5.52435 13.7456 4.84579C13.3401 4.16723 12.7579 3.61158 12.0611 3.23819C11.3644 2.86479 10.5793 2.68768 9.78969 2.72577C9.00011 2.76386 8.2357 3.01572 7.57812 3.45445"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M2 2L18 18"
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

export const BellSlashedIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsBellSlashedIcon = createIcon({
	displayName: 'AsBellSlashedIcon',
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
