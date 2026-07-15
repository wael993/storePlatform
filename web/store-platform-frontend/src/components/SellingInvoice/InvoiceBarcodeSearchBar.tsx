import {
	Box,
	Flex,
	Input,
	InputGroup,
	InputLeftElement,
	Text,
} from '@chakra-ui/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PAGE_COLORS } from './constants'
import { normalizeSearchQuery } from './productSearch'
import { AsQrCodeIcon } from '../../icons/QrCode'

interface InvoiceBarcodeSearchBarProps {
	onSubmit: (value: string) => void
	autoFocus?: boolean
}

const InvoiceBarcodeSearchBar = ({
	onSubmit,
	autoFocus = true,
}: InvoiceBarcodeSearchBarProps) => {
	const { t } = useTranslation()
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (!autoFocus) return

		const timer = setTimeout(() => {
			inputRef.current?.focus()
		}, 100)

		return () => clearTimeout(timer)
	}, [autoFocus])

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== 'Enter') return

		event.preventDefault()

		const value = normalizeSearchQuery(inputRef.current?.value ?? '')
		if (!value) return

		onSubmit(value)

		if (inputRef.current) {
			inputRef.current.value = ''
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
					ref={inputRef}
					onKeyDown={handleKeyDown}
					placeholder={t('components.sellingInvoices.barcodeSearchPlaceholder')}
					border="none"
					_focus={{ boxShadow: 'none' }}
					fontSize="md"
					pl="2.75rem"
					autoComplete="off"
					spellCheck={false}
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
