import React from 'react'
import TextLabel from '../common/TextLabel'
import {
	Box,
	Button,
	Divider,
	Flex,
	HStack,
	SimpleGrid,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { ActionTypes } from '../../shared/globalEnums'
import { Dropdown } from '../dropdown/Dropdown'
import { dropdownStyles } from '../filters/dropdowns/styles'
import InputLabel from '../common/InputLabel'
import {
	documentNameStyles,
	hoverFocusActiveButtonStyles,
} from '../../theme/styles'
import { AsCheckmarkCircleIcon } from '../../icons/CheckmarkCircle'

const styles = {
	button: {
		margin: { base: '0 0 1rem 2rem', md: '1rem' },
		backgroundColor: '#376288',
		fontSize: '0.875rem',
		p: { base: '4', md: '1rem 1.5rem 1rem 1.5rem' },
		whiteSpace: 'nowrap',
		borderRadius: '0',
		...hoverFocusActiveButtonStyles,
	},
}
interface DailyActionDataTabProps {
	actionType: string
}
const DailyActionDataTab = ({ actionType }: DailyActionDataTabProps) => {
	const { t } = useTranslation()
	const options = [
		{ label: 'خيار 0', value: 'option0' },
		{ label: 'خيار 1', value: 'option1' },
		{ label: 'خيار 2', value: 'option2' },
	]
	const purchaseAction = () => {
		return (
			<>
				<SimpleGrid columns={[1, 2, 3]} gap={6}>
					{/* Sales Area */}
					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<TextLabel label={' اسم المنتج'} />

						<Box sx={dropdownStyles.dropDownContainer}>
							<Dropdown
								placeholder={t('اسم المنتج')}
								dropDownOptions={options}
								selectedValues={[]}
								onSelect={() => {}}
							/>
						</Box>
					</VStack>
					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<TextLabel label={' اسم الباىع'} />

						<Box sx={dropdownStyles.dropDownContainer}>
							<Dropdown
								placeholder={t('اسم الباىع')}
								dropDownOptions={options}
								selectedValues={[]}
								onSelect={() => {}}
							/>
						</Box>
					</VStack>
					<VStack>
						<InputLabel
							// inputRef={documentNameRef}
							label={'نوع الوحدة'}
							inputPlaceholder={'نوع الوحدة'}
							inputType={'text'}
							styles={documentNameStyles}
							value={'documentName'}
							onChange={() => {}}
						/>
					</VStack>

					<VStack>
						<InputLabel
							// inputRef={documentNameRef}
							label={'نوع الوحدة'}
							inputPlaceholder={'نوع الوحدة'}
							inputType={'text'}
							styles={documentNameStyles}
							value={'documentName'}
							onChange={() => {}}
						/>
					</VStack>

					<VStack sx={{ gap: '1rem', alignItems: 'left' }}>
						<TextLabel label={' اسم الوحدة'} />

						<Box sx={dropdownStyles.dropDownContainer}>
							<Dropdown
								placeholder={t('اسم الوحدة')}
								dropDownOptions={options}
								selectedValues={[]}
								onSelect={() => {}}
							/>
						</Box>
					</VStack>
				</SimpleGrid>

				<SimpleGrid columns={[1, 2, 3]} gap={6} sx={{ marginTop: '2rem' }}>
					<Button
						rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
						size={'md'}
						variant={'primary'}
						sx={{
							...styles.button,
							backgroundColor: '#376288',
							color: '#FFFFFF',
						}}
					>
						اضافة منتج
					</Button>
					<Button
						rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
						size={'md'}
						variant={'primary'}
						sx={{
							...styles.button,
							backgroundColor: '#376288',
							color: '#FFFFFF',
						}}
					>
						اضافة عملة
					</Button>
					<Button
						rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
						size={'md'}
						variant={'primary'}
						sx={{
							...styles.button,
							backgroundColor: '#376288',
							color: '#FFFFFF',
						}}
					>
						اضافة باىع
					</Button>
					<Button
						rightIcon={<AsCheckmarkCircleIcon style={{ fontSize: '1.5rem' }} />}
						size={'md'}
						variant={'primary'}
						sx={{
							...styles.button,
							backgroundColor: '#376288',
							color: '#FFFFFF',
						}}
					>
						اضافة وحدة
					</Button>
				</SimpleGrid>
			</>
		)
	}

	return (
		<>
			{actionType === ActionTypes.purchase && purchaseAction()}
			{/* {actionType === ActionTypes.purchase && purchaseAction()} */}
		</>
	)
}

export default DailyActionDataTab
