import React from 'react'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import {
	Flex,
	Input,
	InputGroup,
	VStack,
	Text,
	Select,
	InputRightAddon,
} from '@chakra-ui/icons'
import { useTranslation } from 'react-i18next'

const fullWidth = '100%'
const styles: StylesObject = {
	firstColumnTitle: {
		fontSize: '0.875rem',
		fontStyle: 'normal',
		fontWeight: 700,
		lineHeight: 'normal',
	},
	partKey: {
		fontSize: '0.875rem',
		fontStyle: 'normal',
		fontWeight: 400,
		lineHeight: 'normal',
		color: '#848484',
	},
	input: {
		backgroundColor: '#F8F8F8',
		minWidth: '3rem',
	},
	itemWrapper: {
		width: fullWidth,
		paddingBottom: '1rem',
	},
	itemValues: {
		width: '75%',
		alignItems: 'start',
	},
	inputGroup: {
		width: '100%',
		alignItems: 'start',
	},
	selectWrapper: {
		paddingRight: 0,
		backgroundColor: '#F8F8F8',
		border: 0,
	},
	select: {
		backgroundColor: '#F8F8F8',
	},
	iconButton: {
		width: '1rem',
		height: '1rem',
		...hoverFocusActiveButtonStyles,
	},
}
interface SettingItemProps {
	item?: any
	isEditable?: boolean
	isModificationEnabled?: boolean
	onItemValueChange?: (key: string, value: string) => void
	onItemUnitChange?: (key: string, unit: string) => void
}
const SettingItem = ({
	item = {
		units: [{ id: '', labelKey: '' }],
	},
	// isEditable,
	// isModificationEnabled,
	// onItemValueChange,
	// onItemUnitChange,
}: SettingItemProps) => {
	const { t } = useTranslation()

	return (
		<Flex key={item.key} sx={styles.itemWrapper}>
			<VStack sx={styles.itemValues}>
				<Text sx={styles.firstColumnTitle}>
					{t('components.activitySettingsSection.title')}
				</Text>
				<Text sx={styles.partKey}>{item.partKey}</Text>
			</VStack>
			<Flex sx={styles.inputGroup}>
				<InputGroup size="sm">
					<Input
						// isDisabled={!isEditable}
						sx={styles.input}
						variant="filled"
						value={0}
						// onChange={e => {
						// 	onItemValueChange(item.key, e.target.value)
						// }}
						type={item.valueType}
						// isInvalid={!SettingsHelper.isValidSetting(item)}
					/>

					<InputRightAddon sx={styles.selectWrapper}>
						<Select
							// isDisabled={!isEditable}
							sx={styles.select}
							size="sm"
							value={item.unit}
							// onChange={e => {
							// 	onItemUnitChange(item.key, e.target.value)
							// }}
						>
							<option>10</option>
							<option>50 </option>
							<option>100</option>
							{/* {item.units.map(unit => (
								<option key={unit.id} value={unit.id}>
									{t(unit.labelKey)}
								</option>
							))} */}
						</Select>
					</InputRightAddon>
				</InputGroup>
			</Flex>
		</Flex>
	)
}

export default SettingItem
