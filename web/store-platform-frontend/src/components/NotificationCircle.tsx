import { Box, Flex, SystemStyleObject } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'
import { RootState } from '../store/store'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'

interface NotificationCircleProps {
	activityId: string
	showIfNoChanges?: boolean
	children?: React.ReactNode
	customStyles?: Partial<
		Record<'animationCircle' | 'circleWrapper', SystemStyleObject>
	>
	alwaysShowAnimation?: boolean
}

const styles = {
	circleWrapper: {
		justifyContent: 'center',
		alignItems: 'center',
		position: 'relative',
	},
	circle: {
		borderRadius: '50%',
		backgroundColor: '#F6655B',
		position: 'absolute',
	},
}

const pulseAnimation = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
`

const NotificationCircle = ({
	activityId,
	showIfNoChanges = false,
	customStyles,
	children,
	alwaysShowAnimation = false,
}: NotificationCircleProps) => {
	const [activityHasChanges, setActivityHasChanges] = useState(false)

	useEffect(() => {
		setActivityHasChanges(true)
	}, [activityId])

	return (
		(showIfNoChanges || activityHasChanges || alwaysShowAnimation) && (
			<Flex
				sx={{ ...styles.circleWrapper, ...(customStyles?.circleWrapper ?? {}) }}
			>
				{(activityHasChanges || alwaysShowAnimation) && (
					<Box
						animation={`${pulseAnimation} 2s ease-out infinite`}
						sx={{
							...styles.circle,
							width: '1rem',
							height: '1rem',
							...(customStyles?.animationCircle ?? {}),
						}}
					/>
				)}
				{children ? (
					<Box position="absolute">{children}</Box>
				) : (
					<Box sx={{ ...styles.circle, width: '0.4rem', height: '0.42rem' }} />
				)}
			</Flex>
		)
	)
}

export default NotificationCircle
