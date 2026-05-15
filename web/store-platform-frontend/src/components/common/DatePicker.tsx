// import { Box, InputGroup, SystemStyleObject, Tooltip } from '@chakra-ui/react'
// import {
// 	DatepickerConfigs,
// 	PropsConfigs,
// } from 'chakra-dayzed-datepicker/dist/utils/commonTypes'
// import { useEffect, useState } from 'react'
// import { CustomSingleDatepicker } from './CustomSingleDatePicker'
// import { t } from 'i18next'

// import merge from 'lodash/merge'
// import hoverFocusActiveButtonStyles from '../../theme'

// type DatePickerStylesObjectKeys =
// 	| 'inputGroup'
// 	| 'dropDownIcon'
// 	| 'inputGroupRightElement'
// 	| 'boxWrapper'
// 	| 'clearButton'
// 	| 'inputGroupLeftElement'
// export type DatePickerStylesObject = {
// 	[key in DatePickerStylesObjectKeys]?: SystemStyleObject
// }

// interface DatePickerProps {
// 	minDate?: Date
// 	maxDate?: Date
// 	defaultDate?: Date
// 	clearable?: boolean
// 	onDateChange: (date?: Date) => void
// 	placeholder?: string
// 	styles?: DatePickerStylesObject
// 	resetToInitial?: boolean
// 	showCalendarIcon?: boolean
// 	selected?: string | Date | undefined
// 	inputPropsStyles?: PropsConfigs['inputProps']
// 	usePortal?: boolean
// 	isCalendarIconOnRightSide?: boolean
// 	iconColor?: string
// 	showStartDateIcon?: boolean
// 	showEndDateIcon?: boolean
// 	disabled?: boolean
// 	disabledDates?: Set<number>
// 	disableManualDateInput?: boolean
// }

// const styleVariables = {
// 	color: '#939596',
// 	fontSize: { base: '1rem', lg: '0.9rem' },
// 	fontWeight: '700',
// 	lineHeight: '1.2rem',
// 	height: '2.8rem',
// 	sidePadding: '0.7rem',
// 	inputPaddingRight: '1.9rem',
// 	iconWidth: '1rem',
// 	position: 'relative',
// }

// const propsConfig: PropsConfigs = {
// 	dayOfMonthBtnProps: {
// 		defaultBtnProps: {
// 			borderColor: 'red.300',
// 			_hover: {
// 				background: 'blue.400',
// 			},
// 		},
// 		selectedBtnProps: {
// 			background: 'blue.200',
// 		},
// 		isInRangeBtnProps: {
// 			background: 'blue.200',
// 		},
// 	},
// 	inputProps: {
// 		height: styleVariables.height,
// 		paddingLeft: styleVariables.sidePadding,
// 		cursor: 'pointer',
// 		color: styleVariables.color,
// 		lineHeight: styleVariables.lineHeight,
// 		fontSize: styleVariables.fontSize,
// 		fontWeight: styleVariables.fontWeight,
// 		paddingRight: styleVariables.inputPaddingRight,
// 		border: '0',
// 		borderRadius: '0',
// 		_placeholder: {
// 			color: styleVariables.color,
// 			lineHeight: styleVariables.lineHeight,
// 			fontSize: styleVariables.fontSize,
// 			fontWeight: styleVariables.fontWeight,
// 		},
// 		_focusVisible: {
// 			zIndex: '0',
// 			borderColor: '#3182ce',
// 			boxShadow: '0 0 0 1px #3182ce',
// 		},
// 	},
// }
// const DatePicker = ({
// 	minDate,
// 	maxDate,
// 	defaultDate,
// 	clearable,
// 	onDateChange,
// 	placeholder,
// 	styles,
// 	resetToInitial,
// 	showCalendarIcon,
// 	selected,
// 	inputPropsStyles,
// 	usePortal,
// 	isCalendarIconOnRightSide = false,
// 	iconColor = '#939596',
// 	showStartDateIcon = false,
// 	showEndDateIcon = false,
// 	disabled = false,
// 	disabledDates,
// 	disableManualDateInput = false,
// }: DatePickerProps) => {
// 	const [selectedDate, setSelectedDate] = useState<Date | undefined>(
// 		selected ? new Date(selected) : defaultDate,
// 	)
// 	const [isTyping, setIsTyping] = useState<boolean>(false)
// 	const [tooltipText, setTooltipText] = useState<string>(
// 		t('components.filters.datePickerTooltip'),
// 	)

// 	const datePickerConfiguration: DatepickerConfigs = {
// 		dateFormat: 'dd.MM.yyyy',
// 		firstDayOfWeek: 1, // Monday
// 	}

// 	// styles default needs to be inside the component because it will be changed based on styles prop
// 	const stylesDefault: DatePickerStylesObject = {
// 		dropDownIcon: {
// 			color: iconColor,
// 			width: styleVariables.iconWidth,
// 			height: '1.1rem',
// 			strokeWidth: '0.1rem',
// 		},
// 		clearButton: {
// 			color: 'var(--ghui-colors-neutral-500)',
// 			...hoverFocusActiveButtonStyles,
// 		},
// 		inputGroupRightElement: {
// 			cursor: 'pointer',
// 			zIndex: '0',
// 			right: '0.5rem',
// 			height: styleVariables.height,
// 			justifyContent: 'flex-end',
// 		},
// 		inputGroup: {
// 			isolation: 'auto',
// 			pointerEvents: disabled ? 'none' : 'auto',
// 		},
// 		boxWrapper: {
// 			width: '100%',
// 		},
// 		inputGroupLeftElement: {
// 			cursor: 'pointer',
// 			height: styleVariables.height,
// 			width: styleVariables.iconWidth,
// 			position: styleVariables.position,
// 		},
// 	}
// 	const mergedStyles = merge(stylesDefault, styles)

// 	useEffect(() => {
// 		if (resetToInitial) {
// 			setSelectedDate(defaultDate || undefined)
// 		}
// 	}, [resetToInitial, defaultDate])

// 	useEffect(() => {
// 		if (selected) {
// 			setSelectedDate(new Date(selected))
// 		} else {
// 			setSelectedDate(undefined)
// 		}
// 	}, [selected])

// 	const handleDateChange = (date?: Date) => {
// 		if (date) {
// 			setSelectedDate(date)
// 			onDateChange(date)
// 		} else {
// 			setSelectedDate(undefined)
// 			onDateChange(undefined)
// 		}
// 	}

// 	const handleTyping = (state: boolean) => setIsTyping(state)
// 	const changeTooltipText = (text: string) => setTooltipText(text)

// 	return (
// 		<Box sx={mergedStyles.boxWrapper}>
// 			<Tooltip closeOnScroll={true} label={tooltipText} isOpen={isTyping}>
// 				<InputGroup sx={mergedStyles.inputGroup}>
// 					<CustomSingleDatepicker
// 						showCalendarIcon={showCalendarIcon}
// 						showStartDateIcon={showStartDateIcon}
// 						showEndDateIcon={showEndDateIcon}
// 						minDate={minDate}
// 						maxDate={maxDate}
// 						onDateChange={handleDateChange}
// 						setIsTyping={handleTyping}
// 						setTooltipText={changeTooltipText}
// 						date={selectedDate ?? undefined}
// 						configs={datePickerConfiguration}
// 						propsConfigs={{
// 							...propsConfig,
// 							inputProps: {
// 								...propsConfig.inputProps,
// 								placeholder: placeholder ?? '',
// 								...inputPropsStyles,
// 							},
// 						}}
// 						resetToInitial={resetToInitial}
// 						clearable={clearable}
// 						styles={
// 							mergedStyles as React.ComponentProps<
// 								typeof CustomSingleDatepicker
// 							>['styles']
// 						}
// 						isTyping={isTyping}
// 						isCalendarIconOnRightSide={isCalendarIconOnRightSide}
// 						usePortal={usePortal}
// 						disabled={disabled}
// 						disabledDates={disabledDates}
// 						disableManualDateInput={disableManualDateInput}
// 					/>
// 				</InputGroup>
// 			</Tooltip>
// 		</Box>
// 	)
// }

// export default DatePicker

import React from 'react'

const DatePicker = () => {
	return <div>DatePicker</div>
}

export default DatePicker
