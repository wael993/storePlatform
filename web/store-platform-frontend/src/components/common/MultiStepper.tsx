import { Box, HStack } from '@chakra-ui/react'
import { Fragment } from 'react/jsx-runtime'

const getStyles = (
	isCurrent?: boolean,
	isStepCompleted?: boolean,
	customStepSize?: string,
	customConnectorWidth?: string,
	isStepClickable?: boolean,
) =>
	({
		wrapper: {
			gap: '0',
		},
		step: {
			width: customStepSize || '0.625rem',
			height: customStepSize || '0.625rem',
			backgroundColor: 'transparent',
			...(!isCurrent && {
				border: `2px solid #EAEAEA`,
			}),
			borderRadius: '50%',
			...(isCurrent && {
				backgroundColor:'#366085',
			}),
			...(isStepClickable && {
				cursor: 'pointer',
			}),
		},
		connector: {
			width: customConnectorWidth || '1.25rem',
			height: '2px',
			backgroundColor: isStepCompleted
				? '#85B5DF'
				: '#EAEAEA',
		},
	}) satisfies StylesObject

interface MultiStepperProps {
	numberOfSteps: number
	currentStep: number
	customStepSize?: string
	customConnectorWidth?: string
	setStep?: (step: number) => void
}

const MultiStepper = ({
	numberOfSteps,
	currentStep,
	customStepSize,
	customConnectorWidth,
	setStep,
}: MultiStepperProps) => {
	return (
		<HStack sx={getStyles().wrapper}>
			{Array.from({ length: numberOfSteps }, (_, index) => index + 1).map(
				step => {
					const isStepCompleted = step < currentStep
					const styles = getStyles(
						currentStep >= step,
						isStepCompleted,
						customStepSize,
						customConnectorWidth,
						!!setStep,
					)

					return (
						<Fragment key={step}>
							<Box
								key={step}
								sx={styles.step}
								onClick={() => setStep && setStep(step)}
							/>
							{step < numberOfSteps && <Box sx={styles.connector} />}
						</Fragment>
					)
				},
			)}
		</HStack>
	)
}

export default MultiStepper
