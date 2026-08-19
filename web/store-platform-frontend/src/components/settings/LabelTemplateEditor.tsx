import { useEffect, useState } from 'react'
import {
	Box,
	Button,
	Flex,
	FormControl,
	FormLabel,
	HStack,
	Input,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	NumberInput,
	NumberInputField,
	Select,
	Text,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import LabelPreview from '../product/LabelPreview'
import {
	cloneLabelLayout,
	defaultField,
	LABEL_FIELD_TYPES,
	LabelField,
	LabelFieldType,
	LabelLayout,
	LabelTemplate,
	LabelTextAlign,
	SYSTEM_LABEL_LAYOUT,
} from '../../shared/labelTemplate'

interface LabelTemplateEditorProps {
	template?: LabelTemplate
	values: {
		storeName: string
		storeLogo: string
		productName: string
		barcode: string
		barcodeValue: string
		price: string
		category: string
	}
	isOpen: boolean
	onClose: () => void
	onSave: (payload: { name: string; layout: LabelLayout }) => Promise<void>
	isSaving?: boolean
}

const LabelTemplateEditor = ({
	template,
	values,
	isOpen,
	onClose,
	onSave,
	isSaving,
}: LabelTemplateEditorProps) => {
	const { t } = useTranslation()
	const [name, setName] = useState('')
	const [layout, setLayout] = useState<LabelLayout>(
		cloneLabelLayout(SYSTEM_LABEL_LAYOUT),
	)
	const [selectedId, setSelectedId] = useState<string | undefined>()

	useEffect(() => {
		if (!isOpen) {
			return
		}

		const nextLayout = cloneLabelLayout(template?.layout ?? SYSTEM_LABEL_LAYOUT)
		setName(template?.name ?? '')
		setLayout(nextLayout)
		setSelectedId(nextLayout.fields[0]?.id)
	}, [isOpen, template])

	const selected = layout.fields.find(field => field.id === selectedId)
	const unusedTypes = LABEL_FIELD_TYPES.filter(
		type => !layout.fields.some(field => field.type === type),
	)

	const updateField = (id: string, patch: Partial<LabelField>) => {
		setLayout(current => ({
			...current,
			fields: current.fields.map(field =>
				field.id === id ? { ...field, ...patch } : field,
			),
		}))
	}

	const addField = (type: LabelFieldType) => {
		const field = defaultField(type)
		setLayout(current => ({ ...current, fields: [...current.fields, field] }))
		setSelectedId(field.id)
	}

	const removeSelected = () => {
		if (!selected || selected.type === 'barcode') {
			return
		}

		setLayout(current => ({
			...current,
			fields: current.fields.filter(field => field.id !== selected.id),
		}))
		setSelectedId(undefined)
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="4xl">
			<ModalOverlay />
			<ModalContent maxW="920px">
				<ModalHeader>
					{template
						? t('components.labelTemplates.editTitle')
						: t('components.labelTemplates.createTitle')}
				</ModalHeader>
				<ModalCloseButton />
				<ModalBody>
					<Flex gap={6} align="flex-start" wrap="wrap">
						<VStack align="stretch" spacing={3} minW="220px" flex="1">
							<FormControl>
								<FormLabel fontSize="sm">
									{t('components.labelTemplates.name')}
								</FormLabel>
								<Input
									value={name}
									onChange={event => setName(event.target.value)}
								/>
							</FormControl>
							<HStack>
								<FormControl>
									<FormLabel fontSize="sm">
										{t('components.labelTemplates.width')}
									</FormLabel>
									<NumberInput
										min={20}
										value={layout.width}
										onChange={(_, value) =>
											setLayout(current => ({
												...current,
												width: Number.isNaN(value) ? current.width : value,
											}))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
								<FormControl>
									<FormLabel fontSize="sm">
										{t('components.labelTemplates.height')}
									</FormLabel>
									<NumberInput
										min={15}
										value={layout.height}
										onChange={(_, value) =>
											setLayout(current => ({
												...current,
												height: Number.isNaN(value) ? current.height : value,
											}))
										}
									>
										<NumberInputField />
									</NumberInput>
								</FormControl>
							</HStack>
							{unusedTypes.length > 0 ? (
								<FormControl>
									<FormLabel fontSize="sm">
										{t('components.labelTemplates.addField')}
									</FormLabel>
									<Select
										placeholder={t('components.labelTemplates.selectField')}
										onChange={event => {
											if (event.target.value) {
												addField(event.target.value as LabelFieldType)
												event.target.value = ''
											}
										}}
									>
										{unusedTypes.map(type => (
											<option key={type} value={type}>
												{t(`components.labelTemplates.fields.${type}`)}
											</option>
										))}
									</Select>
								</FormControl>
							) : null}
							{selected ? (
								<VStack align="stretch" spacing={2}>
									<Text fontSize="sm" fontWeight={700}>
										{t(`components.labelTemplates.fields.${selected.type}`)}
									</Text>
									{selected.type !== 'barcode' &&
									selected.type !== 'storeLogo' ? (
										<>
											<HStack>
												<FormControl>
													<FormLabel fontSize="sm">
														{t('components.labelTemplates.fontSize')}
													</FormLabel>
													<NumberInput
														min={6}
														max={24}
														value={selected.fontSize ?? 8}
														onChange={(_, value) =>
															updateField(selected.id, {
																fontSize: Number.isNaN(value) ? 8 : value,
															})
														}
													>
														<NumberInputField />
													</NumberInput>
												</FormControl>
												<FormControl>
													<FormLabel fontSize="sm">
														{t('components.labelTemplates.spacing')}
													</FormLabel>
													<NumberInput
														min={0}
														max={8}
														value={selected.padding ?? 0}
														onChange={(_, value) =>
															updateField(selected.id, {
																padding: Number.isNaN(value) ? 0 : value,
															})
														}
													>
														<NumberInputField />
													</NumberInput>
												</FormControl>
											</HStack>
											<FormControl>
												<FormLabel fontSize="sm">
													{t('components.labelTemplates.align')}
												</FormLabel>
												<Select
													value={selected.align ?? 'left'}
													onChange={event =>
														updateField(selected.id, {
															align: event.target.value as LabelTextAlign,
														})
													}
												>
													<option value="left">
														{t('components.labelTemplates.alignLeft')}
													</option>
													<option value="center">
														{t('components.labelTemplates.alignCenter')}
													</option>
													<option value="right">
														{t('components.labelTemplates.alignRight')}
													</option>
												</Select>
											</FormControl>
										</>
									) : (
										<FormControl>
											<FormLabel fontSize="sm">
												{t('components.labelTemplates.spacing')}
											</FormLabel>
											<NumberInput
												min={0}
												max={8}
												value={selected.padding ?? 0}
												onChange={(_, value) =>
													updateField(selected.id, {
														padding: Number.isNaN(value) ? 0 : value,
													})
												}
											>
												<NumberInputField />
											</NumberInput>
										</FormControl>
									)}
									{selected.type !== 'barcode' ? (
										<Button
											size="sm"
											variant="outline"
											onClick={removeSelected}
										>
											{t('components.labelTemplates.removeField')}
										</Button>
									) : null}
								</VStack>
							) : null}
						</VStack>
						<Box>
							<Text fontSize="sm" mb={2} fontWeight={600}>
								{t('components.labelTemplates.preview')}
							</Text>
							<LabelPreview
								layout={layout}
								values={values}
								selectedId={selectedId}
								onSelect={setSelectedId}
								onMove={(id, x, y) => updateField(id, { x, y })}
								onResize={(id, width, height) =>
									updateField(id, { width, height })
								}
							/>
						</Box>
					</Flex>
				</ModalBody>
				<ModalFooter gap={3}>
					<Button variant="ghost" onClick={onClose}>
						{t('common.cancel')}
					</Button>
					<Button
						isLoading={isSaving}
						isDisabled={!name.trim()}
						onClick={() => void onSave({ name: name.trim(), layout })}
					>
						{t('common.save')}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	)
}

export default LabelTemplateEditor
