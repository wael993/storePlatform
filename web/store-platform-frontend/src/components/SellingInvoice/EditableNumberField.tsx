import { HStack, Input, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatNumber, parseNumberValue } from '../../shared/utils'

interface EditableNumberFieldProps {
	value: number
	currency?: string
	isEditable?: boolean
	fontSize?: string
	fontWeight?: number | string
	color?: string
	minWidth?: string
	onSave: (value: number) => void | Promise<void>
}

const toEditValue = (value: number) =>
	Number.isFinite(value) ? value.toFixed(2) : '0.00'

const EditableNumberField = ({
	value,
	currency,
	isEditable = true,
	fontSize = 'sm',
	fontWeight = 600,
	color,
	minWidth = '4rem',
	onSave,
}: EditableNumberFieldProps) => {
	const inputRef = useRef<HTMLInputElement | null>(null)
	const skipBlurCommitRef = useRef(false)
	const [isEditing, setIsEditing] = useState(false)
	const [draft, setDraft] = useState(toEditValue(value))

	const displayText = `${formatNumber(value) ?? toEditValue(value)}${
		currency ? ` ${currency}` : ''
	}`

	useEffect(() => {
		if (!isEditing) {
			setDraft(toEditValue(value))
		}
	}, [value, isEditing])

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	const startEditing = () => {
		if (!isEditable) return
		skipBlurCommitRef.current = false
		setDraft(toEditValue(value))
		setIsEditing(true)
	}

	const cancelEditing = () => {
		skipBlurCommitRef.current = true
		setDraft(toEditValue(value))
		setIsEditing(false)
	}

	const commitEditing = async () => {
		if (skipBlurCommitRef.current) {
			skipBlurCommitRef.current = false
			return
		}

		const parsed = Number.parseFloat(draft)
		if (!Number.isFinite(parsed) || parsed < 0) {
			cancelEditing()
			return
		}

		skipBlurCommitRef.current = true
		setIsEditing(false)
		if (parsed !== value) {
			await onSave(parsed)
		}
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			event.preventDefault()
			void commitEditing()
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

	if (!isEditing) {
		return (
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
		)
	}

	return (
		<HStack
			// spacing={1}
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
				onChange={e => setDraft(parseNumberValue(e.target.value))}
				onBlur={() => {
					void commitEditing()
				}}
				onKeyDown={handleKeyDown}
				variant="unstyled"
				type="text"
				inputMode="decimal"
				cursor="text"
				padding={'0.3rem'}
				{...sharedTextStyles}
			/>
			{/* {currency ? (
				<Text {...sharedTextStyles} flexShrink={0}>
					{currency}
				</Text>
			) : null} */}
		</HStack>
	)
}

export default EditableNumberField
