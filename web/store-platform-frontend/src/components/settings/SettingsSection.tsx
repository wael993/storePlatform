import { Flex, Heading, VStack, Text } from '@chakra-ui/react'
import React from 'react'
import SettingItem from './SettingItem'

const fullWidth = '100%'
const styles: StylesObject = {
	container: {
		width: fullWidth,
		justifyContent: 'space-between',
		flexDir: { base: 'column', md: 'row' },
		padding: '1.5rem 0rem',
	},
	divider: {
		borderBottom: '2px solid #ECECEC',
		marginRight: '0.5rem',
	},
	title: {
		fontWeight: 700,
		lineHeight: '1.5rem',
		color: '#2B2B2B',
		fontSize: '1.25rem',
	},
	note: {
		fontWeight: 500,
		fontSize: '0.875rem',
		color: '#939596',
	},
	titleWrapper: {
		width: fullWidth,
		alignItems: 'start',
	},
	itemsWrapper: {
		width: fullWidth,
		justifyContent: 'end',
		flexDir: 'column',
	},
	itemWrapper: {
		width: fullWidth,
		paddingBottom: '1rem',
	},
	titleSkeleton: {
		width: '70%',
		height: '1.5rem',
		marginBottom: '1rem',
	},
	itemSkeleton: {
		width: fullWidth,
		height: '1.5rem',
		marginLeft: '1rem',
	},
	addButtonWrapper: {
		justifyContent: 'end',
		paddingBottom: '3rem',
		width: fullWidth,
	},
	addButton: {
		backgroundColor: '#f8f8f8',
		color: '#376288',
		fontWeight: 700,
		height: '2rem',
		padding: '0rem 1.5rem',
		fontSize: '0.875rem',
	},
	addButtonIcon: { fontSize: '1.2rem' },
}
interface SettingsSectionProps {
	isEditable?: boolean
	title?: string
	note?: string
	firstColumnTitle?: string
	secondColumnTitle?: string
	items?: any[]
	// onChange: (value: Setting[]) => void
	user?: User
	isDocumentSection?: boolean
}
const SettingsSection = ({
	// isEditable,
	title,
	note = 'note',
	items = [
		{ labelKey: 'productsPerPage', value: 'Products per page', unit: '' },
	],
	// user,
	// onChange,
	// isDocumentSection = false,
}: SettingsSectionProps) => {
	return (
		<>
			<Flex sx={styles.container}>
				<VStack sx={styles.titleWrapper}>
					<Heading sx={styles.title} variant="h5">
						{title}
					</Heading>
					<Text sx={styles.note}>{note}</Text>
				</VStack>
				<Flex sx={styles.itemsWrapper}>
					{items?.map(item => (
						<SettingItem
							key={item.key}
							item={item}
							// isEditable={isEditable}
							// isModificationEnabled={isModificationEnabled}
							// onItemValueChange={onItemValueChange}
							// onItemUnitChange={onItemUnitChange}
						/>
					))}
				</Flex>
			</Flex>
		</>
	)
}

export default SettingsSection
