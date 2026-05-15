import { Box, Flex, SystemCSSProperties, Tooltip } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

interface StateCircleProps {
	stateTitle: string
	stateColor: string
	customStyles?: Partial<
		Record<'colorCircle' | 'circleWrapper', SystemCSSProperties>
	>
	isTooltipEnabled?: boolean
}

const StateCircle = ({
	stateColor,
	stateTitle,
	customStyles,
	isTooltipEnabled = true,
}: StateCircleProps) => {
	const styles: StylesObject = {
		colorCircle: {
			width: '1.25rem',
			height: '1.25rem',
			bgColor: stateColor ?? '#808080',
			borderRadius: 50,
		},
		circleWrapper: {
			justifyContent: 'center',
			alignItems: 'center',
		},
	}

	const { t } = useTranslation()

	return (
		<Flex
			sx={{ ...styles.circleWrapper, ...(customStyles?.circleWrapper ?? {}) }}
		>
			<Tooltip
				closeOnScroll={true}
				label={t(stateTitle as TranslationKey)}
				isDisabled={!isTooltipEnabled}
			>
				<Box
					sx={{ ...styles.colorCircle, ...(customStyles?.colorCircle ?? {}) }}
				/>
			</Tooltip>
		</Flex>
	)
}

export default StateCircle
