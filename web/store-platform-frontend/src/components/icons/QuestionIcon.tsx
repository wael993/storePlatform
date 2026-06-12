import { Icon, createIcon, type IconProps } from '@chakra-ui/react'

const IconPath = () => (
	<>
		<path
			d="M6.672 6.6C6.86008 6.06533 7.23132 5.61449 7.71996 5.32731C8.20861 5.04013 8.78312 4.93515 9.34174 5.03097C9.90037 5.12679 10.4071 5.41722 10.7721 5.85082C11.1371 6.28443 11.3368 6.83322 11.336 7.4C11.336 9 8.936 9.8 8.936 9.8M9 13H9.008M17 9C17 13.4183 13.4183 17 9 17C4.58172 17 1 13.4183 1 9C1 4.58172 4.58172 1 9 1C13.4183 1 17 4.58172 17 9Z"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</>
)

const width = '20'
const height = '20'
const viewBox = `0 0 ${width} ${height}`

export const QuestionIcon = (props: IconProps) => {
	return (
		<Icon xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
			<IconPath />
		</Icon>
	)
}

export const AsQuestionIcon = createIcon({
	displayName: 'QuestionIcon',
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
