import {
	Box,
	IconButton,
	InputGroup,
	InputRightElement,
	Tooltip,
	VStack,
	type CSSObject,
} from '@chakra-ui/react'
import { SingleDatepicker } from 'chakra-dayzed-datepicker'
import { PropsConfigs } from 'chakra-dayzed-datepicker/dist/utils/commonTypes'
import { useEffect, useRef, useState } from 'react'
import { CustomTooltip } from './CustomTooltip'
import { t } from 'i18next'
import { addYears, endOfYear } from 'date-fns'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import { generateDisabledDates } from '../list/shared/dateUtils'
import { AsCalendarIcon } from '../icons/Calendar'
import { AsCloseIcon } from '../icons/Close'

interface LabelStyle {
	color?: string
	fontSize?: string
	fontWeight?: number
}

interface DateInputStyle {
	color?: string
	fontSize?: string
	fontWeight?: number
	backgroundColor?: string
	borderRadius?: string
	border?: string
	width?: string
	paddingRight?: string
	_focusVisible?: CSSObject
}

interface CalendarIconStyle {
	color?: string
}

export interface DatePickerLabelStyles {
	label?: LabelStyle
	dateInput?: DateInputStyle
	calendarIcon?: CalendarIconStyle
	placeholder?: CSSObject
}

interface DatePickerLabelProps {
	label: string
	onChange: (date: Date | undefined) => void
	defaultDate?: Date
	minDate?: Date
	maxDate?: Date
	styles?: DatePickerLabelStyles
	isDateDisabled?: (date: Date) => boolean
	isDisabled?: boolean
	placeholder?: string
	allowClear?: boolean
	usePortal?: boolean
	minDateForDisabledDates?: Date
}

const defaultStyles = {
	container: {
		alignItems: 'flex-start',
		width: '100%',
	},
	textWrapper: {
		width: '80%',
	},
	inputGroup: {
		color: '#6A6A6A',
		backgroundColor: '#F8F8F8',
		borderRadius: '0',
		isolation: 'auto',
	},
	inputRightElement: {
		width: 'fit-content',
	},
	calendarIcon: {
		...hoverFocusActiveButtonStyles,
		color: '#333333',
		fontSize: '1.5rem',
		borderLeft: '1px solid #E8E8E8',
		cursor: 'pointer',
	},
	datePickerWrapper: {
		width: '100%',
		caretColor: 'transparent',
		borderColor: '#E8E8E8',
		'& > div': {
			width: '100%',
		},
		'& input': {
			width: '100%',
		},
	},
} satisfies StylesObject

const safeMaxDate = endOfYear(addYears(new Date(), 25))

const DatePickerLabel = ({
	label,
	onChange,
	defaultDate,
	minDate,
	maxDate = safeMaxDate,
	styles,
	isDateDisabled,
	isDisabled = false,
	placeholder = t('common.datePlaceholder'),
	allowClear = false,
	usePortal = false,
	minDateForDisabledDates,
}: DatePickerLabelProps) => {
	const [date, setDate] = useState<Date | undefined>(defaultDate)
	const datePickerRef = useRef<HTMLDivElement | null>(null)
	const maximumAllowedDate = maxDate > safeMaxDate ? safeMaxDate : maxDate
	const disabledDates = generateDisabledDates({
		maxDate: maximumAllowedDate,
		minDate: minDateForDisabledDates,
		filterFn: isDateDisabled,
	})

	useEffect(() => {
		setDate(defaultDate)
	}, [defaultDate])

	const propsConfig: PropsConfigs = {
		dayOfMonthBtnProps: {
			defaultBtnProps: {
				borderColor: 'transparent',
				_hover: {
					background: '#F4F4F4',
				},
			},
			selectedBtnProps: {
				background: '#1E1E1E',
				color: '#FFFFFF',
				_hover: {
					background: '#1E1E1E',
				},
			},
			isInRangeBtnProps: {
				background: '#F4F4F4',
			},
		},
		inputProps: {
			width: '100%',
			height: '2.5rem',
			paddingLeft: '0.6rem',
			cursor: 'pointer',
			color: '#1E1E1E',
			backgroundColor: '#F4F4F4',
			lineHeight: '1.2rem',
			fontSize: '0.875rem',
			fontWeight: 500,
			paddingRight: allowClear ? '4.8rem' : '2.5rem',
			borderRadius: '0px',
			border: '1px solid #EAEAEA',
			_focusVisible: {
				borderColor: '#E8E8E8',
			},
			placeholder: placeholder,
			_placeholder: {
				color: '#929494',
				...(styles?.placeholder ?? {}),
			},
			...styles?.dateInput,
		},
	}

	const handleDateChange = (selectedDate: Date) => {
		setDate(selectedDate)
		onChange(selectedDate)
	}

	const openDatePicker = () =>
		datePickerRef.current?.querySelector<HTMLButtonElement>('button')?.click()

	return (
		<VStack sx={defaultStyles.container}>
			<CustomTooltip
				label={label}
				styles={{ ...defaultStyles.textWrapper, ...styles?.label }}
			>
				{label}
			</CustomTooltip>

			<InputGroup sx={defaultStyles.inputGroup}>
				{allowClear && (
					<InputRightElement
						sx={{ ...defaultStyles.inputRightElement, right: '2.5rem' }}
					>
						<Tooltip label={t('common.clearDate')}>
							<IconButton
								aria-label={t('common.clearDate')}
								variant="ghost"
								sx={{
									...defaultStyles.calendarIcon,
									...styles?.calendarIcon,
								}}
								onClick={() => {
									setDate(undefined)
									onChange(undefined)
								}}
								icon={<AsCloseIcon />}
								isDisabled={isDisabled}
							/>
						</Tooltip>
					</InputRightElement>
				)}

				<Box
					sx={defaultStyles.datePickerWrapper}
					ref={datePickerRef}
				>
					<SingleDatepicker
						minDate={minDate}
						maxDate={maximumAllowedDate}
						triggerVariant="input"
						triggerIcon={<AsCalendarIcon />}
						propsConfigs={{
							...propsConfig,
							inputProps: {
								...propsConfig.inputProps,
								onClick: openDatePicker,
							},
							...(usePortal
								? {
										popoverCompProps: {
											popoverContentProps: {
												rootProps: {
													zIndex: 9999,
												},
											},
										},
									}
								: {}),
						}}
						configs={{
							firstDayOfWeek: 1,
							dateFormat: 'dd.MM.yyyy',
						}}
						date={date}
						name="date-input"
						onDateChange={handleDateChange}
						disabledDates={disabledDates}
						disabled={isDisabled}
						usePortal={usePortal}
					/>
				</Box>
			</InputGroup>
		</VStack>
	)
}

export default DatePickerLabel
