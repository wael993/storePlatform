import {
	MenuList,
	VStack,
	Text,
	Flex,
	Divider,
	MenuItem,
	InputGroup,
	InputRightElement,
	Icon,
	Input,
	InputLeftElement,
} from '@chakra-ui/react'
import React, {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import DropdownMenuItem from './DropdownMenuItem'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

import { useTranslation } from 'react-i18next'
import { AsCloseIcon } from '../icons/Close'
import { AsSearchIcon } from '../../icons/Search'
import {
	DROPDOWN_OPTION_FIXED_HEIGHT_IN_REM,
	dropdownStyleVariables,
} from '../filters/dropdowns/sharedConstants'
import { parsePastedValues } from '../filters/filterUtils'
import { compareLanguage } from '../../shared/utils'
import i18n from '../../i18n'

type DropdownMenuListProps = {
	styles: StylesObject
	options: DropdownOption[]
	selectedOptions: DropdownOption[]
	isSingle: boolean
	showClearIconOnOption: boolean
	handleSelectionChange: (value: string, isCleared?: boolean) => void
	isOpen: boolean
	isVirtualized: boolean
	isSearchable?: boolean
	noOptionsSelection?: DropdownOption
	allowMultipleEntriesAtOnce?: boolean
	handleMultipleSelectionChange: (options: DropdownOption[]) => void
}

const listStyles = {
	container: {
		padding: 0,
		borderRadius: 0,
		overflowX: 'hidden',
		whiteSpace: 'nowrap',
	},
	searchWrapper: {
		flexDir: 'column',
		position: 'sticky',
		top: 0,
		zIndex: 1,
		background: '#FFFFFF',
	},
	searchInput: {
		borderRadius: 0,
		border: 'none',
		color: '#1E1E1E',
		fontSize: '0.9rem',
		fontWeight: 500,
		_focus: {
			outline: 'none',
			border: 'none',
		},
		_focusVisible: {
			outline: 'none',
			border: 'none',
		},
	},
	divider: {
		borderBottom: dropdownStyleVariables.border,
	},
	optionsWrapper: {
		padding: '0.5rem 0rem',
		flexDirection: 'column',
		alignItems: 'flex-start',
		alignSelf: 'stretch',
		gap: 0,
		maxHeight: '15rem',
		overflowY: 'auto',
	},
	noOption: {
		color: '#929494',
		padding: dropdownStyleVariables.spacing,
		paddingLeft: '1rem',
	},
	searchClearIcon: {
		color: dropdownStyleVariables.color,
		cursor: 'pointer',
		_hover: { backgroundColor: '#F4F4F4' },
		borderRadius: '0.25rem',
	},
} satisfies StylesObject

const DropdownMenuList = memo(
	({
		options,
		selectedOptions,
		isSingle,
		showClearIconOnOption,
		isOpen,
		isVirtualized,
		handleSelectionChange,
		isSearchable = true,
		noOptionsSelection,
		allowMultipleEntriesAtOnce,
		handleMultipleSelectionChange,
	}: DropdownMenuListProps) => {
		const [searchTerm, setSearchTerm] = useState('')
		const [pendingBulkPasteTerms, setPendingBulkPasteTerms] = useState<
			string[]
		>([])
		const [currentItemIndex, setCurrentItemIndex] = useState(-1)
		const { t } = useTranslation()

		const { isArabic } = compareLanguage(i18n.language)
		const inputRef = useRef<HTMLInputElement>(null)

		const optionsScrollRef = useRef<HTMLDivElement>(null)
		const virtuosoRef = useRef<VirtuosoHandle>(null)
		const savedScrollTopRef = useRef<number | null>(null)
		const suppressBlurRefocusRef = useRef(false)

		const normalizedLabelByValue = useMemo(() => {
			const map = new Map<string, string>()
			options.forEach(option => {
				if (option.value === undefined || option.value === null) return
				const normalizedLabel = option.label
					?.toLowerCase()
					.replaceAll(' ', '')
					.trim()
				if (!normalizedLabel) return
				map.set(option.value, normalizedLabel)
			})

			return map
		}, [options])

		useEffect(() => {
			if (!allowMultipleEntriesAtOnce || pendingBulkPasteTerms.length === 0) {
				return
			}

			const selectedValues = new Set(
				selectedOptions.map(option => option.value),
			)
			const matchedOptions = new Map<string, DropdownOption>()

			options.forEach(option => {
				if (!option?.value) return
				if (selectedValues.has(option.value)) return
				const normalizedLabel = normalizedLabelByValue.get(option.value)
				if (!normalizedLabel) return
				if (pendingBulkPasteTerms.includes(normalizedLabel)) {
					matchedOptions.set(option.value, option)
				}
			})

			const invalidOptions = pendingBulkPasteTerms
				.filter(
					term =>
						!Array.from(matchedOptions.values()).some(
							option => normalizedLabelByValue.get(option.value) === term,
						),
				)
				.filter(term => !selectedValues.has(term))
				.map(term => ({
					value: term,
					label: term,
					isInvalid: true,
				}))

			const optionsToAdd = [
				...Array.from(matchedOptions.values()),
				...invalidOptions,
			]

			setPendingBulkPasteTerms([])
			setSearchTerm('')
			if (!optionsToAdd.length) return

			handleMultipleSelectionChange(optionsToAdd)
		}, [
			allowMultipleEntriesAtOnce,
			pendingBulkPasteTerms,
			handleMultipleSelectionChange,
			options,
			selectedOptions,
			normalizedLabelByValue,
		])

		useEffect(() => {
			let timeout: ReturnType<typeof setTimeout>
			if (isOpen) {
				timeout = setTimeout(() => {
					inputRef.current?.focus()
				})
			}
			setCurrentItemIndex(-1)
			return () => clearTimeout(timeout)
		}, [isOpen])

		const filteredOptions = useMemo(() => {
			let filteredOptions: DropdownOption[] = options
			const normalizedSearchTerm = searchTerm.toLowerCase().replaceAll(' ', '')

			// sometimes options has two spaces in between words which is not obvious in the dropdown to eye
			filteredOptions = options.filter(option =>
				option.label
					?.toLowerCase()
					.replaceAll(' ', '')
					.includes(normalizedSearchTerm),
			)

			if (filteredOptions.length === 0 && noOptionsSelection) {
				return [noOptionsSelection]
			}

			return filteredOptions
		}, [options, searchTerm, noOptionsSelection])

		const optionsToShow = useMemo(() => {
			return filteredOptions.filter(
				option => option.value !== undefined && option.value !== null,
			)
		}, [filteredOptions])

		useEffect(() => {
			setCurrentItemIndex(-1)
		}, [isVirtualized, optionsToShow.length])

		const keyDownCallback = useCallback(
			(e: KeyboardEvent) => {
				if (!isVirtualized) return
				let nextIndex = 0
				if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
					nextIndex =
						e.code === 'ArrowUp'
							? Math.max(-1, currentItemIndex - 1)
							: Math.min(optionsToShow.length - 1, currentItemIndex + 1)
					e.code === 'ArrowDown' && inputRef.current?.blur()
					e.code === 'ArrowUp' && nextIndex === -1 && inputRef.current?.focus()
				} else if (
					(e.code === 'Enter' || e.code === 'Space') &&
					document.activeElement !== inputRef.current
				) {
					e.preventDefault()

					const item = optionsToShow[currentItemIndex]
					if (item) {
						handleSelectionChange(item.value)
					}
					return
				}

				if (
					nextIndex !== null &&
					nextIndex !== currentItemIndex &&
					virtuosoRef.current
				) {
					const offset = e.code === 'ArrowUp' ? -2 : 2
					const scrollIndex = Math.max(
						0,
						Math.min(optionsToShow.length - 1, nextIndex + offset),
					)
					virtuosoRef.current.scrollIntoView({
						index: scrollIndex,
						behavior: 'auto',
						done: () => {
							setCurrentItemIndex(nextIndex)
						},
					})
					e.preventDefault()
					e.stopPropagation()
				}
			},
			[
				currentItemIndex,
				virtuosoRef,
				setCurrentItemIndex,
				isVirtualized,
				handleSelectionChange,
				optionsToShow,
			],
		)

		useEffect(() => {
			if (isOpen) {
				document.addEventListener('keydown', keyDownCallback)
				return () => {
					document.removeEventListener('keydown', keyDownCallback)
				}
			}
		}, [isOpen, keyDownCallback])

		const onRangeChanged = ({
			startIndex,
			endIndex,
		}: {
			startIndex: number
			endIndex: number
		}) => {
			if (currentItemIndex === -1 && startIndex === 0) return
			if (currentItemIndex >= startIndex && currentItemIndex <= endIndex) return
			setCurrentItemIndex(Math.min(startIndex + 2, optionsToShow.length - 1))
		}

		const listHeight =
			optionsToShow.length * DROPDOWN_OPTION_FIXED_HEIGHT_IN_REM

		const dropdownMenuListStyles = {
			virtuoso: {
				height: `min(${listHeight}rem, 15rem)`,
				width: '100%',
			},
		} satisfies StylesObject

		const handleInputPaste = useCallback(
			(e: React.ClipboardEvent<HTMLInputElement>) => {
				if (!allowMultipleEntriesAtOnce) return
				const clipboardText = e.clipboardData.getData('text')
				const parsedTerms = parsePastedValues(clipboardText)
				if (!parsedTerms.length) return

				e.preventDefault()
				setPendingBulkPasteTerms(parsedTerms)
			},
			[allowMultipleEntriesAtOnce],
		)

		const handleSelectionChangePreservingScroll = useCallback(
			(value: string, isCleared?: boolean) => {
				savedScrollTopRef.current = optionsScrollRef.current?.scrollTop ?? 0
				handleSelectionChange(value, isCleared)
			},
			[handleSelectionChange],
		)

		return (
			<MenuList sx={listStyles.container}>
				{isSearchable && (
					<Flex sx={listStyles.searchWrapper}>
						<MenuItem onFocus={() => inputRef.current?.focus()}>
							<InputGroup>
								<Input
									ref={inputRef}
									sx={listStyles.searchInput}
									placeholder={t('common.inputSearch')}
									value={searchTerm}
									onChange={e => setSearchTerm(e.target.value)}
									onPaste={handleInputPaste}
									onClick={e => e.stopPropagation()}
									onKeyDown={e => {
										if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
											suppressBlurRefocusRef.current = true
											setTimeout(
												() => (suppressBlurRefocusRef.current = false),
												0,
											)
										}

										if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
											e.stopPropagation()
										}
									}}
									onBlur={e => {
										if (suppressBlurRefocusRef.current) return
										const relatedTarget = e.relatedTarget as HTMLElement | null
										const menuList = (e.currentTarget as HTMLElement).closest(
											'[role="menu"]',
										)
										if (relatedTarget && menuList?.contains(relatedTarget)) {
											inputRef.current?.focus()
										}
									}}
								/>

								{!isArabic && (
									<InputRightElement>
										{searchTerm.length > 0 ? (
											<Icon
												onClick={e => {
													e.stopPropagation()
													e.preventDefault()
													setSearchTerm('')
												}}
												boxSize={5}
												as={AsCloseIcon}
												sx={listStyles.searchClearIcon}
											/>
										) : (
											<Icon
												as={AsSearchIcon}
												sx={{ color: dropdownStyleVariables.color }}
												pointerEvents="none"
											/>
										)}
									</InputRightElement>
								)}

								{isArabic && (
									<InputLeftElement>
										{searchTerm.length > 0 ? (
											<Icon
												onClick={e => {
													e.stopPropagation()
													e.preventDefault()
													setSearchTerm('')
												}}
												boxSize={5}
												as={AsCloseIcon}
												sx={listStyles.searchClearIcon}
											/>
										) : (
											<Icon
												as={AsSearchIcon}
												sx={{ color: dropdownStyleVariables.color }}
												pointerEvents="none"
											/>
										)}
									</InputLeftElement>
								)}
							</InputGroup>
						</MenuItem>

						<Divider sx={listStyles.divider} />
					</Flex>
				)}

				<VStack
					ref={optionsScrollRef}
					align="start"
					sx={listStyles.optionsWrapper}
				>
					{optionsToShow.length > 0 ? (
						isVirtualized ? (
							<Virtuoso
								ref={virtuosoRef}
								style={dropdownMenuListStyles.virtuoso}
								data={optionsToShow}
								rangeChanged={onRangeChanged}
								overscan={40}
								itemContent={(index, option) => {
									const isSelected = selectedOptions.some(
										selected => selected.value === option.value,
									)
									return (
										<DropdownMenuItem
											isSelected={isSelected}
											option={option}
											handleSelectionChange={
												handleSelectionChangePreservingScroll
											}
											isSingle={isSingle}
											showClearIconOnOption={showClearIconOnOption}
											key={`${option.value}-${index}`}
											isCustomFocused={index === currentItemIndex}
											isVirtualized={isVirtualized}
										/>
									)
								}}
							/>
						) : (
							optionsToShow.map((option, index) => (
								<DropdownMenuItem
									isSelected={selectedOptions.some(
										selected => selected.value === option.value,
									)}
									option={option}
									handleSelectionChange={handleSelectionChangePreservingScroll}
									isSingle={isSingle}
									showClearIconOnOption={showClearIconOnOption}
									key={`${option.value}-${index}`}
								/>
							))
						)
					) : (
						<Text sx={listStyles.noOption}>{t('common.noOptions')}</Text>
					)}
				</VStack>
			</MenuList>
		)
	},
)

DropdownMenuList.displayName = 'DropdownMenuList'

export default DropdownMenuList
