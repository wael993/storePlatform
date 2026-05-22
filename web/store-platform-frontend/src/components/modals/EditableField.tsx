import {
	Box,
	HStack,
	Icon,
	IconButton,
	IconProps,
	Input,
	InputProps,
	NumberInput,
	NumberInputField,
	ResponsiveValue,
	Skeleton,
	SystemStyleObject,
	Text,
	Tooltip,
} from '@chakra-ui/react'
import {
	ChangeEvent,
	ComponentType,
	SetStateAction,
	Dispatch,
	useEffect,
	useRef,
	useState,
} from 'react'

import LoadingSpinner from '../../icons/LoadingSpinner'
import DatePicker from '../common/DatePicker'
import { formatDate } from '../../shared/dateUtils'
import { formatNumber } from '../../shared/utils'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { EditIcon } from '../icons/Edit'
import { CloseIcon } from '../icons/Close'
import { AsCheckmarkIcon } from '../../icons/Checkmark'

interface EditableFieldsProps {
	ariaLabelName: string
	iconLeft?: ComponentType<IconProps>
	onFieldEdition: (editedValue: string) => Promise<void>
	placeholder?: string
	tooltip?: string
	isNumberField?: boolean
	isDateField?: boolean
	value?: string
	currency?: string
	textWidth?: ResponsiveValue<string>
	minWidth?: string
	maxWidth?: string
	isLoading?: boolean
	isEditable?: boolean
	iconSize?: string
	fontColor?: string
	numberInputHeight?: string
	checkIconMarginRight?: string
	numberInputFontSize?: string
	iconsGap?: string
	customStyles?: Partial<
		Record<'mainRow' | 'mainTextWrapper' | 'valueText', SystemStyleObject>
	>
	usePortalForDate?: boolean
	disableLineWrap?: boolean
	disabledDates?: Set<number>
	maxDate?: Date
	minDate?: Date
	minimumDecimals?: number
	maximumDecimals?: number
	disableManualDateInput?: boolean
	propsSetIsEditionEnabled?: Dispatch<SetStateAction<boolean>>
}
const EditableField = ({
	ariaLabelName,
	placeholder,
	tooltip = '',
	iconLeft,
	isNumberField = false,
	isDateField = false,
	onFieldEdition,
	value,
	currency,
	textWidth,
	isLoading,
	isEditable = true,
	iconSize = '1.5rem',
	fontColor = '#707070',
	numberInputHeight = '1.5rem',
	checkIconMarginRight = '0rem',
	numberInputFontSize,
	iconsGap = '0.15rem',
	customStyles,
	usePortalForDate = true,
	disableLineWrap = false,
	disabledDates,
	maxDate,
	minDate,
	minWidth = '5rem',
	maxWidth = '100%',
	maximumDecimals = 2,
	minimumDecimals = 2,
	disableManualDateInput = false,
	propsSetIsEditionEnabled,
}: EditableFieldsProps) => {
	const [isEditionEnabled, setIsEditionEnabled] = useState<boolean>(false)

	useEffect(() => {
		if (propsSetIsEditionEnabled) {
			propsSetIsEditionEnabled(isEditionEnabled)
		}
	}, [isEditionEnabled, propsSetIsEditionEnabled])

	const inputRef = useRef<HTMLInputElement | null>(null)
	const parseCustomFloat = (value?: string) => {
		if (value) {
			const valueFormatted = value.replaceAll(',', '')
			return parseFloat(valueFormatted).toFixed(maximumDecimals)
		} else {
			return ''
		}
	}

	const parseNumberValue = (value: string): string => {
		value = value.replace(/[^\d.]/g, '')

		// Ensure there is only one dot
		const dotIndex = value.indexOf('.')
		if (dotIndex !== -1) {
			value =
				value.slice(0, dotIndex + 1) +
				value.slice(dotIndex + 1).replace(/\./g, '')
		}

		// Limit to 2 decimal places
		const parts = value.split('.')
		if (parts.length > 1) {
			parts[1] = parts[1].slice(0, maximumDecimals)
			value = parts.join('.')
		}

		return value
	}
	const getOriginValue = () =>
		isNumberField ? parseCustomFloat(value) : value || ''

	const originalValue = getOriginValue()

	const [fieldValue, setFieldValue] = useState<string>(originalValue)

	const styles = {
		mainRow: {
			border: `1px solid #F4F4F4`,
			borderRadius: '0',
			width: '100%',
			backgroundColor: isEditionEnabled ? '#D8D8D8' : undefined,
			justifyContent: 'flex-end',
			gap: '0',
			paddingX: '0',
		},
		mainTextWrapper: {
			gap: '0.5rem',
			width: '100%',
		},
		icon: {
			fontSize: iconSize,
			color: fontColor,
		},
		editIcon: {
			color: fontColor,
			minWidth: iconSize,
			minHeight: iconSize,
			maxWidth: iconSize,
			maxHeight: iconSize,
			cursor: 'pointer',
		},
		numberInput: {
			border: 'none',
			fontWeight: 500,
			_focusVisible: {
				outlineStyle: 'none',
			},
			color: fontColor,
			paddingX: 0,
			fontSize: numberInputFontSize,
			height: numberInputHeight,
		},
		input: {
			border: 'none',
			fontWeight: 500,
			_focusVisible: {
				outlineStyle: 'none',
			},
			color: '#1E1E1E',
			paddingX: 0,
		},
		iconButton: {
			...hoverFocusActiveButtonStyles,
			color: fontColor,
			cursor: 'pointer',
			backgroundColor: 'unset',
			minWidth: 'unset',
		},
		valueText: {
			color: '#1E1E1E',
			fontSize: '1rem',
			fontWeight: '500',
			lineHeight: '1.2rem',
			paddingLeft: 0,
			minWidth: minWidth,
			width: textWidth,
			maxWidth: textWidth,
			whiteSpace: disableLineWrap ? 'nowrap' : 'break-spaces',
			overflowWrap: 'anywhere',
		},
		skeletonText: {
			width: textWidth,
			height: '1.5rem',
		},
	} satisfies StylesObject

	useEffect(() => {
		if (isEditionEnabled && inputRef.current) {
			inputRef.current.select()
		}
	}, [isEditionEnabled])

	useEffect(() => {
		setFieldValue(originalValue)
	}, [value])

	return isEditionEnabled ? (
		<HStack
			sx={{
				...styles.mainRow,
				...(customStyles?.mainRow ?? {}),
			}}
			onClick={e => e.stopPropagation()}
		>
			<HStack>
				{iconLeft && <Icon sx={styles.icon} as={iconLeft} />}
				{isNumberField ? (
					<NumberInput
						width={textWidth}
						maxWidth={maxWidth}
						defaultValue={originalValue}
						min={0}
						precision={maximumDecimals}
						step={1 / 10 ** maximumDecimals}
						value={fieldValue}
						onChange={newValue => {
							setFieldValue(parseNumberValue(newValue))
						}}
					>
						<NumberInputField
							ref={inputRef}
							sx={{
								...styles.numberInput,
								...customStyles?.valueText,
							}}
						/>
					</NumberInput>
				) : isDateField ? (
					// <DatePicker
					// 	showCalendarIcon={true}
					// 	onDateChange={value => setFieldValue(value?.toString() ?? '')}
					// 	placeholder={placeholder}
					// 	selected={fieldValue ? new Date(fieldValue) : undefined}
					// 	inputPropsStyles={{
					// 		paddingLeft: '0.5rem',
					// 		paddingRight: '0.25rem',
					// 		height: '1.5rem',
					// 		...((customStyles?.valueText ?? {}) as InputProps),
					// 	}}
					// 	styles={{
					// 		inputGroup: { height: '1.5rem' },
					// 		inputGroupLeftElement: { height: '1.5rem' },
					// 	}}
					// 	usePortal={usePortalForDate}
					// 	iconColor={fontColor}
					// 	disabledDates={disabledDates}
					// 	maxDate={maxDate}
					// 	minDate={minDate}
					// 	disableManualDateInput={disableManualDateInput}
					// />
					<></>
				) : (
					<Input
						ref={inputRef}
						sx={styles.input}
						value={fieldValue}
						onChange={(e: ChangeEvent<HTMLInputElement>) =>
							setFieldValue(e.target.value)
						}
					/>
				)}
			</HStack>
			{isLoading ? (
				<Box marginInline="0.5rem">
					<LoadingSpinner marginTop="0rem" size="sm" />
				</Box>
			) : (
				<HStack gap={iconsGap} justifyContent="flex-end">
					<CloseIcon
						style={{ ...styles.iconButton, marginLeft: '0.5rem', zIndex: 3 }}
						onClick={e => {
							setFieldValue(originalValue)
							setIsEditionEnabled(false)
							e.stopPropagation()
						}}
						aria-label={`cancel-${ariaLabelName}-edit`}
					/>
					<IconButton
						sx={styles.iconButton}
						marginRight={checkIconMarginRight}
						icon={<AsCheckmarkIcon color={fontColor} />}
						isDisabled={fieldValue === originalValue}
						pointerEvents={fieldValue === originalValue ? 'none' : 'auto'}
						onClick={e => {
							e.stopPropagation()
							onFieldEdition(fieldValue).then(() => setIsEditionEnabled(false))
						}}
						aria-label={`submit-${ariaLabelName}-edit`}
					/>
				</HStack>
			)}
		</HStack>
	) : (
		<Tooltip
			closeOnScroll={true}
			placement="bottom-start"
			label={tooltip}
			isDisabled={!tooltip}
		>
			<HStack
				sx={{
					...styles.mainTextWrapper,
					...(customStyles?.mainTextWrapper ?? {}),
				}}
			>
				{iconLeft && <Icon sx={styles.icon} as={iconLeft} />}

				{isLoading ? (
					<Skeleton sx={styles.skeletonText} />
				) : (
					<Text
						variant="baseStyle"
						sx={{
							...styles.valueText,
							color: !value ? '#929494' : fontColor,
							...(customStyles?.valueText ?? {}),
						}}
						noOfLines={2}
					>
						{value && value.trim() !== ''
							? isDateField
								? formatDate(value)
								: `${
										isNumberField
											? (formatNumber(value, {
													minimumDecimals,
													maximumDecimals,
												}) ?? value)
											: value
									}${currency ? ` ${currency}` : ''}`
							: placeholder || ''}
					</Text>
				)}
				{!!isEditable && !isLoading && (
					<EditIcon
						style={styles.editIcon}
						onClick={e => {
							setIsEditionEnabled(true)
							e.stopPropagation()
						}}
					/>
				)}
			</HStack>
		</Tooltip>
	)
}

export default EditableField
