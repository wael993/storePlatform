import {
	Icon,
	Input,
	InputGroup,
	InputRightElement,
	Textarea,
	Tooltip,
	VStack,
} from '@chakra-ui/react'
import { ChangeEvent, RefObject, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AsCloseIcon } from '../icons/Close'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { CustomTooltip } from './CustomTooltip'

//let timeoutFn: NodeJS.Timeout | null = null

let timeoutFn: any | null = null
const debounceTime: number = 300

const defaultStyles = {
	container: {
		alignItems: 'flex-start',
		width: '100%',
		minWidth: '10rem',
	},
	textWrapper: {
		width: '80%',
	},
	input: {
		...hoverFocusActiveButtonStyles,
		color: '#1E1E1E',
		backgroundColor: '#F4F4F4',
		borderRadius: '0px',
		border: `1px solid #EAEAEA`,
		_placeholder: {
			color: '#929494',
		},
	},
	clearIcon: {
		width: '1.2rem',
		height: '1.2rem',
		color: '#939596',
		_hover: {
			cursor: 'pointer',
		},
	},
} satisfies StylesObject

export interface InputLabelStyles {
	label?: LabelStyle
	input?: InputStyle
}

interface InputStyle {
	color?: string
	fontSize?: string
	fontWeight?: number
	backgroundColor?: string
	borderRadius?: string
	border?: string
	_placeholder?: {
		color?: string
	}
	_hover?: {
		background?: string
	}
}

interface LabelStyle {
	color?: string
	fontSize?: string
	fontWeight?: number
	minHeight?: string
}

interface InputLabelProps {
	inputType: InputType
	isInvalid?: boolean
	label: string
	value?: string
	inputPlaceholder?: string
	isDisabled?: boolean
	onChange?: (value: string) => void
	debounceEnabled?: boolean
	variant?: string
	isClearable?: boolean
	isReadOnly?: boolean
	styles?: InputLabelStyles
	inputRef?: RefObject<HTMLInputElement>
	disabledTooltip?: string
	invalidTooltip?: string
}

const InputLabel = ({
	inputType,
	isInvalid,
	label,
	value,
	inputPlaceholder,
	isDisabled = false,
	onChange,
	debounceEnabled = false,
	variant = 'filled',
	isClearable = false,
	isReadOnly = false,
	styles,
	inputRef,
	disabledTooltip,
	invalidTooltip,
}: InputLabelProps) => {
	const { t } = useTranslation()
	const [inputValue, setInputValue] = useState<string>(value ?? '')

	const handleChange = (value: string) => {
		setInputValue(value)
		if (!debounceEnabled) {
			if (onChange) {
				onChange(value)
			}
			return
		}
		/**
		 * Wait N milliseconds before triggering the onChange callback.
		 */
		if (timeoutFn) {
			clearTimeout(timeoutFn)
		}

		timeoutFn = setTimeout(() => {
			if (onChange) {
				onChange(value)
			}

			timeoutFn = null
		}, debounceTime)
	}

	return (
		<VStack sx={defaultStyles.container}>
			<CustomTooltip
				label={label}
				styles={{ ...defaultStyles.textWrapper, ...styles?.label }}
			>
				{label}
			</CustomTooltip>
			<InputGroup>
				<Tooltip
					label={disabledTooltip || invalidTooltip}
					isDisabled={!isDisabled && !isInvalid}
					placement="bottom-start"
				>
					{inputType === 'text-area' ? (
						<Textarea
							rows={4}
							isInvalid={isInvalid}
							isDisabled={isDisabled}
							sx={{ ...defaultStyles.input, ...styles?.input }}
							variant={variant}
							value={value ?? inputValue}
							placeholder={
								inputPlaceholder ??
								t('components.modals.activityLetter.textPlaceholder')
							}
							onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
								handleChange(event.target.value)
							}
							isReadOnly={isReadOnly}
							resize="none"
						/>
					) : (
						<Input
							ref={inputRef}
							isInvalid={isInvalid}
							isDisabled={isDisabled}
							type={inputType}
							sx={{ ...defaultStyles.input, ...styles?.input }}
							variant={variant}
							value={value ?? inputValue}
							placeholder={
								inputPlaceholder ??
								t('components.modals.activityLetter.textPlaceholder')
							}
							onChange={(event: ChangeEvent<HTMLInputElement>) =>
								handleChange(event.target.value)
							}
							isReadOnly={isReadOnly}
						/>
					)}
				</Tooltip>
				{isClearable && (
					<InputRightElement>
						<Icon
							as={AsCloseIcon}
							sx={defaultStyles.clearIcon}
							onClick={() => handleChange('')}
						/>
					</InputRightElement>
				)}
			</InputGroup>
		</VStack>
	)
}

export default InputLabel
