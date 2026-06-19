import { Button } from '@chakra-ui/react'
import { CSSProperties, JSX } from 'react'
import { useTranslation } from 'react-i18next'

interface ButtonComponentProps {
	onClick: () => void
	marginLeft?: string
	isDisabled?: boolean
	isLoading?: boolean
	icon?: JSX.Element
	label?: string
	variant?: string
	style?: CSSProperties
	customStyles?: Pick<StylesObject, 'icon'>
}

const ButtonComponent = ({
	onClick,
	marginLeft,
	isDisabled,
	isLoading,
	label,
	icon,
	variant,
	style,
	customStyles,
}: ButtonComponentProps) => {
	const { t } = useTranslation()

	const styles: StylesObject = {
		saveButton: {
			width: '6rem',
			marginLeft: marginLeft ?? '1rem',
		},
		icon: {
			fontSize: '1.5rem',
		},
	}

	if (customStyles?.icon) {
		styles.icon = { ...styles.icon, ...customStyles.icon }
	}

	return (
		// <Button
		// 	rightIcon={icon ? <Icon as={icon} /> : undefined}
		// 	variant={variant ?? 'primary'}
		// 	sx={{ ...styles.saveButton, ...style } as CSSProperties}
		// 	onClick={onClick}
		// 	isDisabled={isDisabled || isLoading}
		// 	isLoading={isLoading}
		// >
		// 	{label ?? t('common.save')}
		// </Button>

		<Button
			aria-label={label ?? t('common.save')}
			sx={{ ...styles.icon, ...style } as CSSProperties}
			variant={variant ?? 'primary'}
			isDisabled={isDisabled || isLoading}
			isLoading={isLoading}
			onClick={onClick}
		>
			{label ?? t('common.save')}
			{icon}
		</Button>
	)
}

export default ButtonComponent
