import {
	Checkbox,
	Flex,
	MenuItem,
	SystemStyleObject,
	Tooltip,
	Icon,
	Spacer,
	CloseButton,
} from '@chakra-ui/react'
import React, { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { CustomTooltip } from '../common/CustomTooltip'
import { AsWarningIcon } from '../../icons/Warning'
import { DROPDOWN_OPTION_FIXED_HEIGHT_IN_REM } from '../filters/dropdowns/sharedConstants'
interface DropdownMenuItemProps {
	isSelected: boolean
	option: DropdownOption
	handleSelectionChange: (value: string, isCleared?: boolean) => void
	isSingle: boolean
	showClearIconOnOption: boolean
	isCustomFocused?: boolean
	isVirtualized?: boolean
}

const listItemStyles = {
	optionWrapper: {
		width: '100%',
		padding: '0.5rem 0.625rem',
		alignItems: 'center',
		gap: '0.625rem',
		alignSelf: 'stretch',
		cursor: 'pointer',
		height: `${DROPDOWN_OPTION_FIXED_HEIGHT_IN_REM}rem`,
		maxHeight: `${DROPDOWN_OPTION_FIXED_HEIGHT_IN_REM}rem`,
	},
	statusDot: {
		borderRadius: '50%',
		height: '0.5rem',
		width: '0.5rem',
		minW: '0.5rem',
		minH: '0.5rem',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
	},
	optionText: {
		fontSize: '0.875rem',
		fontStyle: 'normal',
		fontWeight: 500,
		lineHeight: '1.2rem',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		color: '#1E1E1E',
	},
} satisfies StylesObject
const DropdownMenuItem = memo(
	({
		isSelected,
		option,
		handleSelectionChange,
		isSingle,
		showClearIconOnOption,
		isCustomFocused,
		isVirtualized,
	}: DropdownMenuItemProps) => {
		const { t } = useTranslation()

		const menuItemStyles: SystemStyleObject = {
			...listItemStyles.optionWrapper,

			_hover: {
				bg: isSelected ? '#F4F4F4' : '#F4F4F4',
			},
			_focus: {
				bg: '#F4F4F4',
				outline: 'none',
			},

			...(isCustomFocused && {
				bg: isSelected ? '#F4F4F4' : '#F4F4F4',
			}),
		}
		const content = (
			<>
				{!isSingle && (
					<Checkbox isChecked={isSelected} pointerEvents={'none'} />
				)}

				{option.icon}

				{(option.color || option.stateColor) && (
					<Flex
						sx={{
							...listItemStyles.statusDot,
							backgroundColor: option.stateColor || option.color,
						}}
						title={option.stateTitle || undefined}
					/>
				)}
				<CustomTooltip
					label={option.label}
					styles={listItemStyles.optionText}
					openDelay={1000}
					aria-label={option.label}
				>
					{option.label}
				</CustomTooltip>
				{option.isInvalid && (
					<Tooltip label={t('common.optionDoesNotExist')}>
						<Icon
							sx={{ color: '#E45252' }}
							as={AsWarningIcon}
							aria-label="warning"
						/>
					</Tooltip>
				)}
				<Spacer />
				{showClearIconOnOption && isSelected && (
					<CloseButton
						size="sm"
						onClick={e => {
							e.stopPropagation()
							handleSelectionChange(option.value, true)
						}}
					/>
				)}
			</>
		)
		const sharedProps = {
			onClick: (e: React.MouseEvent) => {
				e.stopPropagation()
				handleSelectionChange(option.value)
			},
			sx: menuItemStyles,
		}

		return isVirtualized ? (
			<Flex
				{...sharedProps}
				role="option"
				aria-selected={isSelected}
				tabIndex={-1}
			>
				{content}
			</Flex>
		) : (
			<MenuItem {...sharedProps}>{content}</MenuItem>
		)
	},
)

DropdownMenuItem.displayName = 'DropdownMenuItem'

export default DropdownMenuItem
