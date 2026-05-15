// import {
// 	Icon,
// 	IconButton,
// 	Input,
// 	InputLeftElement,
// 	InputRightElement,
// 	Popover,
// 	PopoverAnchor,
// 	PopoverBody,
// 	PopoverContent,
// 	Portal,
// 	SystemStyleObject,
// 	useDisclosure,
// } from '@chakra-ui/react'
// import {
// 	CalendarPanel,
// 	Month_Names_Short,
// 	Weekday_Names_Short,
// } from 'chakra-dayzed-datepicker'
// import { format, isAfter, isBefore } from 'date-fns'
// import React, { ChangeEvent, useEffect, useRef, useState } from 'react'
// import FocusLock from 'react-focus-lock'

// import {
// 	CalendarConfigs,
// 	DatepickerConfigs,
// 	DatepickerProps,
// 	OnDateSelected,
// } from 'chakra-dayzed-datepicker/dist/utils/commonTypes'
// import { t } from 'i18next'
// import { AsCalendarIcon } from '../icons/Calendar'
// import { CloseIcon } from '../icons/Close'
// import useMultiElementOutsideClick from '../../shared/hooks/useMultiElementOutsideClick'
// import { AsStartDateIcon } from '../icons/StartDate'
// import { AsEndDateIcon } from '../icons/EndDate'

// type datePickerStyleKeys =
// 	| 'inputGroupLeftElement'
// 	| 'dropDownIcon'
// 	| 'inputGroupRightElement'

// export interface SingleDatepickerProps extends DatepickerProps {
// 	date?: Date
// 	onDateChange: (date?: Date) => void
// 	setIsTyping: (isTyping: boolean) => void
// 	setTooltipText: (text: string) => void
// 	configs?: DatepickerConfigs
// 	disabled?: boolean
// 	/**
// 	 * disabledDates: `Uses startOfDay as comparison`
// 	 */
// 	disabledDates?: Set<number>
// 	closeOnSelect?: boolean
// 	id?: string
// 	name?: string
// 	usePortal?: boolean
// 	resetToInitial?: boolean
// 	clearable: boolean | undefined
// 	styles: Record<datePickerStyleKeys, SystemStyleObject> & {
// 		clearButton?: SystemStyleObject
// 	}
// 	showCalendarIcon?: boolean
// 	isTyping?: boolean
// 	isCalendarIconOnRightSide?: boolean
// 	showStartDateIcon?: boolean
// 	showEndDateIcon?: boolean
// 	disableManualDateInput?: boolean
// }

// const DefaultConfigs: CalendarConfigs = {
// 	dateFormat: 'dd.MM.yyyy',
// 	monthNames: Month_Names_Short,
// 	dayNames: Weekday_Names_Short,
// 	firstDayOfWeek: 0,
// }

// export const CustomSingleDatepicker: React.FC<SingleDatepickerProps> = ({
// 	configs,
// 	propsConfigs,
// 	usePortal,
// 	disabledDates,
// 	closeOnSelect = true,
// 	...props
// }) => {
// 	const {
// 		date: selectedDate,
// 		name,
// 		disabled,
// 		onDateChange,
// 		setIsTyping,
// 		setTooltipText,
// 		id,
// 		minDate,
// 		maxDate,
// 		resetToInitial,
// 		clearable,
// 		styles,
// 		showCalendarIcon = false,
// 		isTyping,
// 		isCalendarIconOnRightSide = false,
// 		showStartDateIcon = false,
// 		showEndDateIcon = false,
// 		disableManualDateInput = false,
// 	} = props

// 	const [dateInView, setDateInView] = useState(selectedDate)
// 	const [offset, setOffset] = useState(0)
// 	const [dateInput, setDateInput] = useState<string>()
// 	const [isInvalidDate, setIsInvalidDate] = useState(false)

// 	const calendarConfigs: CalendarConfigs = {
// 		...DefaultConfigs,
// 		...configs,
// 	}
// 	const popoverTriggerRef = useRef<HTMLDivElement | null>(null)
// 	const calendarRef = useRef<HTMLDivElement | null>(null)

// 	const { onOpen, onClose, onToggle, isOpen } = useDisclosure()

// 	useEffect(() => {
// 		if (resetToInitial) {
// 			setOffset(0)
// 			setDateInput(undefined)
// 			setIsInvalidDate(false)
// 		}
// 		setDateInView(selectedDate)

// 		setDateInput(
// 			selectedDate
// 				? format(selectedDate, calendarConfigs.dateFormat)
// 				: undefined,
// 		)
// 	}, [resetToInitial, selectedDate])

// 	useEffect(() => {
// 		if (!isTyping && isInvalidDate) {
// 			setDateInView(selectedDate)
// 			setDateInput(
// 				selectedDate ? format(selectedDate, calendarConfigs.dateFormat) : '',
// 			)
// 			setIsInvalidDate(false)
// 		}
// 	}, [isTyping, isInvalidDate])

// 	const onPopoverClose = () => {
// 		onClose()
// 		setDateInView(selectedDate)
// 		setOffset(0)
// 	}
// 	useMultiElementOutsideClick({
// 		enabled: isOpen,
// 		handler: onPopoverClose,
// 		refs: [
// 			popoverTriggerRef as React.RefObject<HTMLElement>,
// 			calendarRef as React.RefObject<HTMLElement>,
// 		],
// 	})
// 	// dayzed utils
// 	const handleOnDateSelected: OnDateSelected = ({ selectable, date }) => {
// 		if (!selectable) return
// 		if (date instanceof Date && !isNaN(date.getTime())) {
// 			setIsInvalidDate(false)
// 			onDateChange(date)
// 			setDateInput(format(date, calendarConfigs.dateFormat))
// 			setIsTyping(false)
// 			if (closeOnSelect) onClose()
// 			return
// 		}
// 	}

// 	const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
// 		setDateInput(e.target.value)
// 		setIsTyping(true)
// 		setTooltipText(t('components.filters.datePickerTooltip'))

// 		const inputDate = e.target.value.trim()
// 		const [day, month, year] = inputDate.split('.')
// 		const parsedDate = new Date(`${year}-${month}-${day}`)

// 		if (!isNaN(parsedDate.getTime()) && e.target.value.length === 10) {
// 			const minimumDate = minDate || new Date(2023, 0, 1)
// 			if (isBefore(parsedDate, minimumDate)) {
// 				setTooltipText(
// 					t('components.filters.datePickerMinDateErrorTooltip', {
// 						date: format(minimumDate, 'dd.MM.yyyy'),
// 					}),
// 				)
// 				setIsInvalidDate(true)
// 				return
// 			}
// 			const maximumDate = maxDate || new Date(9999, 11, 31)
// 			if (isAfter(parsedDate, maximumDate)) {
// 				setTooltipText(
// 					t('components.filters.datePickerMaxDateErrorTooltip', {
// 						date: format(maximumDate, 'dd.MM.yyyy'),
// 					}),
// 				)
// 				setIsInvalidDate(true)
// 				return
// 			}
// 			setIsInvalidDate(false)
// 			onDateChange(parsedDate)
// 			setIsTyping(false)
// 		} else {
// 			setIsInvalidDate(true)
// 		}
// 	}

// 	const PopoverContentWrapper = usePortal ? Portal : React.Fragment
// 	return (
// 		<Popover
// 			placement="bottom"
// 			variant="responsive"
// 			isOpen={isOpen}
// 			onOpen={onOpen}
// 			onClose={onPopoverClose}
// 			isLazy
// 			closeOnBlur={false}
// 			gutter={0}
// 		>
// 			{showCalendarIcon && !isCalendarIconOnRightSide && (
// 				<InputLeftElement
// 					sx={{
// 						...styles.inputGroupLeftElement,
// 					}}
// 					ref={popoverTriggerRef}
// 				>
// 					<Icon
// 						as={AsCalendarIcon}
// 						sx={{ ...styles.dropDownIcon }}
// 						onClick={onToggle}
// 					/>
// 				</InputLeftElement>
// 			)}

// 			<PopoverAnchor>
// 				<Input
// 					id={id}
// 					autoComplete="off"
// 					isDisabled={disabled}
// 					isReadOnly={disableManualDateInput}
// 					type="text"
// 					name={name}
// 					value={
// 						dateInput
// 							? dateInput
// 							: selectedDate
// 								? format(selectedDate, calendarConfigs.dateFormat)
// 								: ''
// 					}
// 					onChange={e => onInputChange(e)}
// 					onClick={disableManualDateInput ? () => onToggle() : undefined}
// 					onBlur={() => setIsTyping(false)}
// 					{...propsConfigs?.inputProps}
// 				/>
// 			</PopoverAnchor>
// 			<PopoverContentWrapper>
// 				<PopoverContent
// 					width="100%"
// 					{...propsConfigs?.popoverCompProps?.popoverContentProps}
// 					ref={calendarRef}
// 				>
// 					<PopoverBody {...propsConfigs?.popoverCompProps?.popoverBodyProps}>
// 						<FocusLock>
// 							<CalendarPanel
// 								dayzedHookProps={{
// 									showOutsideDays: true,
// 									onDateSelected: handleOnDateSelected,
// 									selected: selectedDate,
// 									date: dateInView,
// 									minDate: minDate,
// 									maxDate: maxDate,
// 									offset: offset,
// 									onOffsetChanged: setOffset,
// 									firstDayOfWeek: calendarConfigs.firstDayOfWeek,
// 								}}
// 								configs={calendarConfigs}
// 								propsConfigs={propsConfigs}
// 								disabledDates={disabledDates}
// 							/>
// 						</FocusLock>
// 					</PopoverBody>
// 				</PopoverContent>
// 			</PopoverContentWrapper>

// 			{((showCalendarIcon && isCalendarIconOnRightSide) ||
// 				(clearable && selectedDate) ||
// 				showStartDateIcon ||
// 				showEndDateIcon) && (
// 				<InputRightElement
// 					sx={{
// 						...styles.inputGroupRightElement,
// 						borderLeft: `1px solid #EAEAEA`,
// 						right: 0,
// 						justifyContent: 'center',
// 					}}
// 					ref={popoverTriggerRef}
// 				>
// 					{clearable && selectedDate && (
// 						<IconButton
// 							boxSize={5}
// 							variant="ghost"
// 							sx={{ ...styles?.clearButton }}
// 							aria-label="clearDate"
// 							onClick={() => {
// 								onDateChange(undefined)
// 								setDateInput(undefined)
// 							}}
// 							icon={<CloseIcon />}
// 						/>
// 					)}
// 					{(showStartDateIcon ||
// 						showEndDateIcon ||
// 						(showCalendarIcon && isCalendarIconOnRightSide)) && (
// 						<Icon
// 							as={
// 								showStartDateIcon
// 									? AsStartDateIcon
// 									: showEndDateIcon
// 										? AsEndDateIcon
// 										: AsCalendarIcon
// 							}
// 							sx={{ ...styles.dropDownIcon }}
// 							onClick={onToggle}
// 						/>
// 					)}
// 				</InputRightElement>
// 			)}
// 		</Popover>
// 	)
// }

import React from 'react'

const CustomSingleDatePicker = () => {
	return <div>CustomSingleDatePicker</div>
}

export default CustomSingleDatePicker
