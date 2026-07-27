import { Box, HStack, Input, Text, Tooltip, VStack } from '@chakra-ui/react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDiscountEditValue, parseDiscountInput } from './discountInput'
import {
	getOtherCurrencyAmountLines,
	type DisplayCurrencyOption,
} from './currencyDisplay'

interface EditableDiscountFieldProps {
	discount: number
	discountIsPercent: boolean
	discountAmount: number
	formatAmount: (amount: number) => string
	isEditable?: boolean
	fontSize?: string
	fontWeight?: number | string
	color?: string
	minWidth?: string
	fieldId?: string
	registerEditStart?: (fieldId: string, start: (() => void) | null) => void
	onEnterCommit?: () => void
	onSave: (discount: number, discountIsPercent: boolean) => void | Promise<void>
	currencyOptions?: DisplayCurrencyOption[]
	displayCurrencyId?: string | null
}

const EditableDiscountField = ({
	discount,
	discountIsPercent,
	discountAmount,
	formatAmount,
	isEditable = true,
	fontSize = 'sm',
	fontWeight = 600,
	color,
	minWidth = '4rem',
	fieldId,
	registerEditStart,
	onEnterCommit,
	onSave,
	currencyOptions,
	displayCurrencyId,
}: EditableDiscountFieldProps) => {
	const { t } = useTranslation()
	const inputRef = useRef<HTMLInputElement | null>(null)
	const skipBlurCommitRef = useRef(false)
	const committingEnterRef = useRef(false)
	const [isEditing, setIsEditing] = useState(false)
	const [draft, setDraft] = useState(() =>
		formatDiscountEditValue(discount, discountIsPercent),
	)

	const displayText = formatAmount(discountAmount)
	const otherCurrencies =
		currencyOptions && displayCurrencyId != null
			? getOtherCurrencyAmountLines(
					discountAmount,
					currencyOptions,
					displayCurrencyId,
				)
			: []

	useEffect(() => {
		if (!isEditing) {
			setDraft(formatDiscountEditValue(discount, discountIsPercent))
		}
	}, [discount, discountIsPercent, isEditing])

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	const startEditing = () => {
		if (!isEditable) return
		skipBlurCommitRef.current = false
		setDraft(formatDiscountEditValue(discount, discountIsPercent))
		setIsEditing(true)
	}

	const startEditingRef = useRef(startEditing)
	startEditingRef.current = startEditing

	useEffect(() => {
		if (!fieldId || !registerEditStart) return

		registerEditStart(fieldId, () => startEditingRef.current())
		return () => registerEditStart(fieldId, null)
	}, [fieldId, registerEditStart])

	const cancelEditing = () => {
		skipBlurCommitRef.current = true
		setDraft(formatDiscountEditValue(discount, discountIsPercent))
		setIsEditing(false)
	}

	const commitEditing = async (): Promise<boolean> => {
		if (skipBlurCommitRef.current) {
			skipBlurCommitRef.current = false
			return false
		}

		const parsed = parseDiscountInput(draft)
		if (!parsed) {
			cancelEditing()
			return false
		}

		skipBlurCommitRef.current = true
		setIsEditing(false)

		if (
			parsed.discount !== discount ||
			parsed.discountIsPercent !== discountIsPercent
		) {
			await onSave(parsed.discount, parsed.discountIsPercent)
		}

		return true
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			event.preventDefault()
			committingEnterRef.current = true
			void commitEditing().then(committed => {
				committingEnterRef.current = false
				if (committed) {
					onEnterCommit?.()
				}
			})
		} else if (event.key === 'Escape') {
			event.preventDefault()
			cancelEditing()
		}
	}

	const sharedTextStyles = {
		fontSize,
		fontWeight,
		color,
		minWidth,
		lineHeight: '1.25',
		whiteSpace: 'nowrap' as const,
	}

	const fieldContent = !isEditing ? (
		<Text
			{...sharedTextStyles}
			cursor={isEditable ? 'pointer' : 'default'}
			onClick={e => {
				e.stopPropagation()
				startEditing()
			}}
		>
			{displayText}
		</Text>
	) : (
		<HStack
			minW={minWidth}
			border="1px solid"
			borderColor="gray.300"
			borderRadius="sm"
			px={1}
			py={0}
			onClick={e => e.stopPropagation()}
		>
			<Input
				ref={inputRef}
				value={draft}
				onChange={e => setDraft(e.target.value)}
				onBlur={() => {
					if (committingEnterRef.current) return
					void commitEditing()
				}}
				onKeyDown={handleKeyDown}
				variant="unstyled"
				type="text"
				inputMode="decimal"
				cursor="text"
				padding="0.3rem"
				{...sharedTextStyles}
			/>
		</HStack>
	)

	const showTooltip = discountIsPercent || otherCurrencies.length > 0

	if (!showTooltip) {
		return fieldContent
	}

	return (
		<Tooltip
			hasArrow
			placement="top"
			openDelay={200}
			label={
				<VStack align="stretch" spacing={1} py={1}>
					{discountIsPercent && (
						<Text fontSize="sm" whiteSpace="nowrap">
							{discount}%
						</Text>
					)}
					{otherCurrencies.length > 0 && (
						<>
							{discountIsPercent && (
								<Box
									borderTop="1px solid"
									borderColor="whiteAlpha.400"
									pt={1}
								/>
							)}
							<Text fontSize="xs" fontWeight={700} opacity={0.85}>
								{t('components.sellingInvoices.drawer.otherCurrencies')}
							</Text>
							{otherCurrencies.map(currency => (
								<Text
									key={currency.currencyId}
									fontSize="sm"
									whiteSpace="nowrap"
								>
									{currency.text}
								</Text>
							))}
						</>
					)}
				</VStack>
			}
		>
			<Box as="span" display="inline-block">
				{fieldContent}
			</Box>
		</Tooltip>
	)
}

export default EditableDiscountField
