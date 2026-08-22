import { Flex, Icon, IconProps, SystemStyleObject } from '@chakra-ui/react'

import { ComponentType, useState } from 'react'
import { useBreakpoints } from '../../shared/hooks/useBreakpoints'

import { compareBreakpoint } from '../../shared/utils'
import EditableField from '../modals/EditableField'

export interface EditableCellFieldProps {
	iconLeft?: ComponentType<IconProps>
	value?: string | number | null
	isNumberField?: boolean
	ariaLabel: string
	placeholder?: string
	onEdit?: (editedValue: string) => Promise<void>
	onEditDate?: (editedValue: Date | undefined) => Promise<void>
	isLoading?: boolean
	currency?: string
	isEditable?: boolean
	customStyles: Partial<
		Record<
			'mainRow' | 'mainTextWrapper' | 'valueText' | 'mainFlexWrapper',
			SystemStyleObject
		>
	>
	isDateField?: boolean
	usePortalForDate?: boolean
	children?: React.ReactNode
	tooltip?: string
	fontColor?: string
	numberInputHeight?: string
	checkIconMarginRight?: string
	iconsGap?: string
	numberInputFontSize?: string
	iconSize?: string
	disableLineWrap?: boolean
	minWidth?: string
	maxWidth?: string
	minDate?: Date
	maxDate?: Date
	textWidth?: string
	inputHeight?: string
	minimumDecimals?: number
	maximumDecimals?: number
	alwaysShowBackground?: boolean
}

const styles = {
	mainFlexWrapper: {
		width: '100%',
		height: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		gap: '0.5rem',
		padding: '0.25rem',
	},
} satisfies StylesObject

const EditableCellField = ({
	value,
	isNumberField,
	ariaLabel,
	placeholder,
	onEdit,
	isLoading = false,
	currency,
	textWidth = '100%',
	isEditable = true,
	customStyles,
	isDateField,
	usePortalForDate = true,
	children,
	tooltip,
	fontColor,
	numberInputHeight = '2rem',
	checkIconMarginRight = '0rem',
	numberInputFontSize,
	iconsGap,
	iconSize = '1.25rem',
	disableLineWrap = false,
	iconLeft,
	minWidth,
	maxWidth,
	minDate,
	maxDate,
	inputHeight = '2.5rem',
	minimumDecimals,
	maximumDecimals,
	alwaysShowBackground = false,
}: EditableCellFieldProps) => {
	const [isHovered, setIsHovered] = useState(false)
	const [isEditionEnabled, setIsEditionEnabled] = useState(false)
	const { isMobile, isTablet } = compareBreakpoint(useBreakpoints())
	const isEditingShown =
		(isHovered || isMobile || isTablet || isLoading || isEditionEnabled) &&
		isEditable

	return (
		<Flex
			sx={{
				...styles.mainFlexWrapper,
				...(customStyles.mainFlexWrapper ?? {}),
				backgroundColor:
					isEditingShown || alwaysShowBackground ? '#E5E5E5' : 'unset',
			}}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{!!iconLeft && (
				<Icon
					sx={{
						height: '90%',
						paddingLeft: '0.3rem',
						width: '1.25rem',
					}}
					as={iconLeft}
				/>
			)}
			{isEditingShown || !children ? (
				<EditableField
					numberInputHeight={numberInputHeight}
					ariaLabelName={ariaLabel}
					placeholder={isEditingShown ? placeholder : ''}
					textWidth={textWidth}
					value={value}
					minDate={minDate}
					maxDate={maxDate}
					disableLineWrap={disableLineWrap}
					isEditable={isEditingShown}
					isDateField={isDateField}
					usePortalForDate={usePortalForDate}
					onFieldEdition={async value => {
						await onEdit?.(value)
						setIsHovered(false)
					}}
					customStyles={{
						mainRow: {
							border: '1px solid #D8D8D8',
							...(customStyles.mainRow ?? {}),
						},
						mainTextWrapper: {
							minHeight: '2rem',
							height: inputHeight,
							...(customStyles.mainTextWrapper ?? {}),
						},
						valueText: {
							...(customStyles.valueText ?? {}),
						},
					}}
					minWidth={minWidth}
					maxWidth={maxWidth}
					isNumberField={isNumberField}
					checkIconMarginRight={checkIconMarginRight}
					iconsGap={iconsGap}
					iconSize={iconSize}
					isLoading={isLoading}
					currency={currency}
					tooltip={tooltip}
					fontColor={fontColor}
					numberInputFontSize={numberInputFontSize}
					minimumDecimals={minimumDecimals}
					maximumDecimals={maximumDecimals}
					propsSetIsEditionEnabled={setIsEditionEnabled}
				/>
			) : (
				children
			)}
		</Flex>
	)
}

export default EditableCellField
