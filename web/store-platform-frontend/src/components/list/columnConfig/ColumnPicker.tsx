import {
	Box,
	Button,
	Checkbox,
	Flex,
	IconButton,
	Input,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverHeader,
	PopoverTrigger,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import { DragEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiEdit2, FiSave, FiSettings } from 'react-icons/fi'
import { MdDragIndicator, MdViewColumn } from 'react-icons/md'
import { AsTrashIcon } from '../../../icons/Trash'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import ConfirmationDialog from '../../ConfirmationDialog'
import useCustomToast from '../../common/CustomToast'
import {
	MAX_SAVED_COLUMN_CONFIGS,
	useListColumnConfig,
} from './ListColumnConfigProvider'

const styles = {
	trigger: {
		background: 'transparent',
		...hoverFocusActiveButtonStyles,
	},
	popover: {
		width: '18rem',
		maxHeight: '24rem',
		overflow: 'hidden',
	},
	header: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingX: '0.75rem',
		paddingY: '0.5rem',
	},
	row: {
		alignItems: 'center',
		gap: '0.5rem',
		paddingY: '0.35rem',
		paddingX: '0.5rem',
		borderRadius: '0.25rem',
		_hover: { background: '#F4F4F4' },
	},
	label: {
		flex: 1,
		fontSize: '0.8125rem',
		color: '#1E1E1E',
		noOfLines: 1,
	},
	configRow: {
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: '0.5rem',
		paddingY: '0.5rem',
		borderBottom: '1px solid #EAEAEA',
		_hover: { background: '#F9F9F9' },
	},
	dragHandle: {
		cursor: 'grab',
		color: '#929494',
		lineHeight: 0,
		flexShrink: 0,
	},
} satisfies StylesObject

const ColumnPicker = () => {
	const { t } = useTranslation()
	const showToast = useCustomToast()
	const {
		pickerColumns,
		isHidden,
		toggle,
		reorder,
		savedConfigs,
		canSaveMore,
		saveCurrent,
		loadConfig,
		renameConfig,
		overwriteConfig,
		deleteConfig,
		isSaving,
		currentCols,
	} = useListColumnConfig()
	const popover = useDisclosure()
	const savedModal = useDisclosure()
	const [dragId, setDragId] = useState<string | null>(null)
	const [newName, setNewName] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingName, setEditingName] = useState('')
	const [pending, setPending] = useState<{
		type: 'overwrite' | 'delete'
		id: string
	} | null>(null)

	useEffect(() => {
		if (!dragId) return
		const previous = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.body.style.overflow = previous
		}
	}, [dragId])

	const handleError = (error: unknown, fallbackKey: string) => {
		const err = error as { data?: { message?: string } }
		showToast({
			status: 'error',
			description: err.data?.message || t(fallbackKey),
		})
	}

	const trimmedNewName = newName.trim()
	const isDuplicateUnchangedSave = savedConfigs.some(
		config => config.name === trimmedNewName && config.cols === currentCols,
	)

	const openSavedConfigs = () => {
		popover.onClose()
		savedModal.onOpen()
	}

	return (
		<>
			<Box sx={styles.trigger}>
				<Popover
					isOpen={popover.isOpen}
					onOpen={popover.onOpen}
					onClose={popover.onClose}
					placement="bottom-end"
					isLazy
				>
					<PopoverTrigger>
						<IconButton
							aria-label={t('components.columnConfig.configureColumns')}
							icon={<MdViewColumn size={20} />}
							size="sm"
							variant="ghost"
							color="#6C6C6C"
						/>
					</PopoverTrigger>
					<PopoverContent sx={styles.popover}>
						<PopoverHeader sx={styles.header} borderBottom="1px solid #EAEAEA">
							<Text fontSize="0.875rem" fontWeight={700}>
								{t('components.columnConfig.columns')}
							</Text>
							<IconButton
								aria-label={t('components.columnConfig.savedConfigurations')}
								icon={<FiSettings size={16} />}
								size="xs"
								variant="ghost"
								onClick={openSavedConfigs}
							/>
						</PopoverHeader>
						<PopoverBody padding="0.5rem" overflowY="auto" maxHeight="20rem">
							{pickerColumns.map(column => (
								<Flex
									key={column.id}
									sx={styles.row}
									onDragOver={event => {
										event.preventDefault()
										event.dataTransfer.dropEffect = 'move'
									}}
									onDrop={event => {
										event.preventDefault()
										const fromId =
											event.dataTransfer.getData('text/plain') || dragId
										if (fromId) reorder(fromId, column.id)
										setDragId(null)
									}}
									opacity={dragId === column.id ? 0.5 : 1}
								>
									<Box
										as="span"
										sx={styles.dragHandle}
										draggable
										aria-hidden
										onDragStart={(event: DragEvent<HTMLSpanElement>) => {
											setDragId(column.id)
											event.dataTransfer.effectAllowed = 'move'
											event.dataTransfer.setData('text/plain', column.id)
										}}
										onDragEnd={() => setDragId(null)}
									>
										<MdDragIndicator size={16} />
									</Box>
									<Text sx={styles.label}>{t(column.labelKey)}</Text>
									<Checkbox
										isChecked={!isHidden(column.id)}
										isDisabled={Boolean(column.locked)}
										onChange={() => toggle(column.id)}
									/>
								</Flex>
							))}
						</PopoverBody>
					</PopoverContent>
				</Popover>
			</Box>
			<Modal isOpen={savedModal.isOpen} onClose={savedModal.onClose} isCentered>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>
						{t('components.columnConfig.savedConfigurations')}
					</ModalHeader>
					<ModalCloseButton />
					<ModalBody paddingBottom="1.5rem">
						<Flex gap="0.5rem" marginBottom="1rem">
							<Input
								value={newName}
								onChange={event => setNewName(event.target.value)}
								placeholder={t('components.columnConfig.namePlaceholder')}
								maxLength={80}
								size="sm"
							/>
							<Button
								size="sm"
								isDisabled={
									!trimmedNewName ||
									isSaving ||
									!canSaveMore ||
									isDuplicateUnchangedSave
								}
								isLoading={isSaving}
								onClick={async () => {
									if (!canSaveMore) {
										showToast({
											status: 'error',
											description: t(
												'components.columnConfig.saveLimitReached',
												{
													max: MAX_SAVED_COLUMN_CONFIGS,
												},
											),
										})
										return
									}
									try {
										await saveCurrent(newName)
										setNewName('')
										showToast({
											status: 'success',
											description: t('components.columnConfig.saveSuccess'),
										})
									} catch (error) {
										if (error instanceof Error && error.message === 'limit') {
											showToast({
												status: 'error',
												description: t(
													'components.columnConfig.saveLimitReached',
													{ max: MAX_SAVED_COLUMN_CONFIGS },
												),
											})
											return
										}
										handleError(error, 'components.columnConfig.saveError')
									}
								}}
							>
								{t('components.columnConfig.saveCurrent')}
							</Button>
						</Flex>
						{savedConfigs.length === 0 ? (
							<Text color="#929494" fontSize="0.875rem">
								{t('components.columnConfig.noSavedConfigurations')}
							</Text>
						) : (
							savedConfigs.map(config => (
								<Flex key={config.id} sx={styles.configRow}>
									{editingId === config.id ? (
										<Input
											size="sm"
											value={editingName}
											autoFocus
											onChange={event => setEditingName(event.target.value)}
											onKeyDown={async event => {
												if (event.key === 'Escape') {
													setEditingId(null)
													return
												}
												if (event.key !== 'Enter' || !editingName.trim()) return
												try {
													await renameConfig(config.id, editingName)
													setEditingId(null)
													showToast({
														status: 'success',
														description: t(
															'components.columnConfig.renameSuccess',
														),
													})
												} catch (error) {
													handleError(
														error,
														'components.columnConfig.saveError',
													)
												}
											}}
										/>
									) : (
										<Text
											flex="1"
											fontSize="0.875rem"
											fontWeight={config.isDefault ? 700 : 500}
											cursor={isSaving ? 'default' : 'pointer'}
											pointerEvents={isSaving ? 'none' : undefined}
											onClick={async () => {
												try {
													await loadConfig(config.id)
													showToast({
														status: 'success',
														description: t(
															'components.columnConfig.loadSuccess',
														),
													})
													savedModal.onClose()
												} catch (error) {
													handleError(
														error,
														'components.columnConfig.saveError',
													)
												}
											}}
										>
											{config.name}
										</Text>
									)}
									<Flex gap="0.15rem">
										<IconButton
											aria-label={t('components.columnConfig.rename')}
											icon={<FiEdit2 size={14} />}
											size="xs"
											variant="ghost"
											isDisabled={isSaving}
											onClick={() => {
												setEditingId(config.id)
												setEditingName(config.name)
											}}
										/>
										<IconButton
											aria-label={t('components.columnConfig.overwrite')}
											icon={<FiSave size={14} />}
											size="xs"
											variant="ghost"
											isDisabled={isSaving || config.cols === currentCols}
											onClick={() =>
												setPending({ type: 'overwrite', id: config.id })
											}
										/>
										<IconButton
											aria-label={t('common.delete')}
											icon={<AsTrashIcon boxSize={3.5} />}
											size="xs"
											variant="ghost"
											isDisabled={isSaving}
											onClick={() =>
												setPending({ type: 'delete', id: config.id })
											}
										/>
									</Flex>
								</Flex>
							))
						)}
					</ModalBody>
				</ModalContent>
			</Modal>
			<ConfirmationDialog
				header={
					pending?.type === 'delete'
						? t('components.columnConfig.deleteConfirm')
						: t('components.columnConfig.overwriteConfirm')
				}
				body={
					pending?.type === 'delete'
						? t('components.columnConfig.deleteConfirmBody')
						: t('components.columnConfig.overwriteConfirmBody')
				}
				isOpen={Boolean(pending)}
				onClose={() => setPending(null)}
				onConfirm={async () => {
					if (!pending) return
					try {
						if (pending.type === 'delete') await deleteConfig(pending.id)
						else await overwriteConfig(pending.id)
						showToast({
							status: 'success',
							description: t(
								pending.type === 'delete'
									? 'components.columnConfig.deleteSuccess'
									: 'components.columnConfig.saveSuccess',
							),
						})
					} catch (error) {
						handleError(error, 'components.columnConfig.saveError')
					} finally {
						setPending(null)
					}
				}}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={
					pending?.type === 'delete' ? t('common.delete') : t('common.save')
				}
				isConfirmationButtonLoading={isSaving}
			/>
		</>
	)
}

export default ColumnPicker
