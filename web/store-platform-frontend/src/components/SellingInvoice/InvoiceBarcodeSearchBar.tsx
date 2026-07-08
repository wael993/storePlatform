import {
	Box,
	Flex,
	Input,
	InputGroup,
	InputLeftElement,
	Text,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

import { PAGE_COLORS } from './constants'
import { AsQrCodeIcon } from '../../icons/QrCode'

interface InvoiceBarcodeSearchBarProps {
	value: string
	onChange: (value: string) => void
	onSubmit: () => void
}

const InvoiceBarcodeSearchBar = ({
	value,
	onChange,
	onSubmit,
}: InvoiceBarcodeSearchBarProps) => {
	const { t } = useTranslation()

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			onSubmit()
		}
	}

	return (
		<Box
			bg="white"
			borderRadius="xl"
			border="1px solid"
			borderColor={PAGE_COLORS.primary}
			p={1}
			mb={6}
			boxShadow={PAGE_COLORS.cardShadow}
		>
			<InputGroup size="lg">
				<InputLeftElement pointerEvents="none" h="full" pl={2}>
					<AsQrCodeIcon color={PAGE_COLORS.primary} />
				</InputLeftElement>
				<Input
					value={value}
					onChange={event => onChange(event.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={t('components.sellingInvoices.barcodeSearchPlaceholder')}
					border="none"
					_focus={{ boxShadow: 'none' }}
					fontSize="md"
					pl="2.75rem"
				/>
				<Flex
					align="center"
					pr={4}
					display={{ base: 'none', md: 'flex' }}
					position="absolute"
					right={0}
					top={0}
					bottom={0}
					pointerEvents="none"
				>
					<Text fontSize="sm" color={PAGE_COLORS.muted}>
						{/* {t('components.sellingInvoices.barcodeSearchHint')} */}
					</Text>
				</Flex>
			</InputGroup>
		</Box>
	)
}

export default InvoiceBarcodeSearchBar
