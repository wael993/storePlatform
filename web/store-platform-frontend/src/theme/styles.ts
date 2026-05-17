interface DateInputStyle {
	color?: string
	fontSize?: string
	fontWeight?: number
}

interface CalendarIconStyle {
	color?: string
}
interface DatePickerLabelStyles {
	label?: LabelStyle
	dateInput?: DateInputStyle
	calendarIcon?: CalendarIconStyle
	placeholder?: StylesObject
}

interface LabelStyle {
	color?: string
	fontSize?: string
	fontWeight?: number
	minHeight?: string
}

interface InputLabelStyles {
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

export const documentNameStyles: InputLabelStyles = {
	label: {
		fontSize: '0.75rem',
		fontWeight: 700,
		color: '#929494',
	},
	input: {
		fontSize: '0.875rem',
		fontWeight: 500,
	},
}

export const datePickerStyles: DatePickerLabelStyles = {
	label: {
		fontSize: '0.75rem',
		fontWeight: 700,
		color: '#929494',
	},
	calendarIcon: {
		color: '#929494',
	},
	dateInput: {
		fontSize: '0.875rem',
		fontWeight: 500,
	},
}

export const hoverFocusActiveButtonStyles: StylesObject = {
	_hover: {},
	_focus: {},
	_focusVisible: {},
	_active: {},
}
export const hoverFocusButtonStyles: StylesObject = {
	_hover: {},
	_focus: {},
}
