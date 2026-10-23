import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Box,
	Button,
	Container,
	Flex,
	FormControl,
	FormErrorMessage,
	FormHelperText,
	FormLabel,
	Heading,
	Image,
	Input,
	Radio,
	RadioGroup,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Select,
	Spinner,
	Stack,
	Tab,
	TabList,
	TabPanel,
	TabPanels,
	Tabs,
	Text,
	Textarea,
	useDisclosure,
} from '@chakra-ui/react'
import { AddIcon } from '@chakra-ui/icons'
import { useTranslation } from 'react-i18next'

import {
	NewsroomReleaseNoteWrite,
	useCreateNewsroomReleaseNoteMutation,
	useDeleteNewsroomReleaseNoteMutation,
	useDuplicateNewsroomReleaseNoteMutation,
	useGetNewsroomReleaseNoteQuery,
	useGetNewsroomTopicsQuery,
	usePublishNewsroomReleaseNoteMutation,
	useUnpublishNewsroomReleaseNoteMutation,
	useUpdateNewsroomReleaseNoteMutation,
} from '../api/apiStore'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import {
	NewsroomReleaseCard,
	NewsroomReleaseDetail,
} from '../components/newsroom/NewsroomViews'
import { BreadCrumbItem } from '../shared/globalEnums'
import {
	buildRoutePath,
	generateBreadcrumbs,
	RoutePaths,
} from '../shared/routes'

const CHANGE_TYPES = ['feature', 'change', 'bug_fix'] as const
const MAX_IMAGE_BYTES = 1_200_000

const dataUrlBytes = (value: string): number => {
	const comma = value.indexOf(',')

	if (comma < 0) return 0

	return Math.floor(((value.length - comma - 1) * 3) / 4)
}

const isOversizedNewsroomImage = (image: string): boolean =>
	image.startsWith('data:') && dataUrlBytes(image) > MAX_IMAGE_BYTES

type ChangeDraft = {
	clientId: string
	changeId?: string
	title: string
	type: (typeof CHANGE_TYPES)[number]
	description: string
	image: string
	topicId: string
}

const newClientId = () =>
	typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `c-${Date.now()}-${Math.random().toString(16).slice(2)}`

const emptyChange = (): ChangeDraft => ({
	clientId: newClientId(),
	title: '',
	type: 'feature',
	description: '',
	image: '',
	topicId: '',
})

const toDatetimeLocal = (iso: string | null | undefined): string => {
	if (!iso) return ''

	const date = new Date(iso)

	if (Number.isNaN(date.getTime())) return ''

	const pad = (value: number) => String(value).padStart(2, '0')

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const apiFields = (error: unknown): Record<string, string> =>
	typeof error === 'object' &&
	error !== null &&
	'data' in error &&
	typeof (error as { data?: { fields?: unknown } }).data?.fields === 'object' &&
	(error as { data: { fields: Record<string, string> } }).data.fields
		? (error as { data: { fields: Record<string, string> } }).data.fields
		: {}

const apiErrorMessage = (error: unknown, fallback: string): string =>
	typeof error === 'object' &&
	error !== null &&
	'data' in error &&
	typeof (error as { data?: { message?: unknown } }).data?.message === 'string'
		? (error as { data: { message: string } }).data.message
		: fallback

const readFileAsDataUrl = (file: File): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader()

		reader.onload = () => resolve(String(reader.result || ''))
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(file)
	})

const NewsroomReleaseNoteEditorPage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { releaseNoteId } = useParams<{ releaseNoteId: string }>()
	const isNew = !releaseNoteId || releaseNoteId === 'new'
	const {
		data: note,
		isLoading,
		isError,
		error: loadError,
	} = useGetNewsroomReleaseNoteQuery(releaseNoteId ?? '', { skip: isNew })
	const { data: topics = [] } = useGetNewsroomTopicsQuery()
	const [createNote, { isLoading: isCreating }] =
		useCreateNewsroomReleaseNoteMutation()
	const [updateNote, { isLoading: isUpdating }] =
		useUpdateNewsroomReleaseNoteMutation()
	const [publishNote, { isLoading: isPublishing }] =
		usePublishNewsroomReleaseNoteMutation()
	const [unpublishNote, { isLoading: isUnpublishing }] =
		useUnpublishNewsroomReleaseNoteMutation()
	const [duplicateNote, { isLoading: isDuplicating }] =
		useDuplicateNewsroomReleaseNoteMutation()
	const [deleteNote, { isLoading: isDeleting }] =
		useDeleteNewsroomReleaseNoteMutation()
	const [title, setTitle] = useState('')
	const [version, setVersion] = useState('')
	const [releaseDateTime, setReleaseDateTime] = useState('')
	const [description, setDescription] = useState('')
	const [changes, setChanges] = useState<ChangeDraft[]>([emptyChange()])
	const [fields, setFields] = useState<Record<string, string>>({})
	const [feedback, setFeedback] = useState('')
	const preview = useDisclosure()
	const breadcrumbs = generateBreadcrumbs({
		name: isNew ? t('newsroom.createNew') : title || t('newsroom.edit'),
	})
	const isBusy =
		isCreating ||
		isUpdating ||
		isPublishing ||
		isUnpublishing ||
		isDuplicating ||
		isDeleting
	const isReadOnly = note?.status === 'published'

	useEffect(() => {
		if (!note || isNew) return

		setTitle(note.title)
		setVersion(note.version)
		setReleaseDateTime(toDatetimeLocal(note.releaseDateTime))
		setDescription(note.description)
		setChanges(
			note.changes.length
				? note.changes.map(change => ({
						clientId: change.changeId,
						changeId: change.changeId,
						title: change.title,
						type: CHANGE_TYPES.includes(
							change.type as (typeof CHANGE_TYPES)[number],
						)
							? (change.type as (typeof CHANGE_TYPES)[number])
							: 'feature',
						description: change.description,
						image: change.image,
						topicId: change.topicId,
					}))
				: [emptyChange()],
		)
	}, [note, isNew])

	const body = useMemo<NewsroomReleaseNoteWrite>(
		() => ({
			title,
			description,
			version,
			releaseDateTime: releaseDateTime
				? new Date(releaseDateTime).toISOString()
				: null,
			releaseDate: releaseDateTime ? releaseDateTime.slice(0, 10) : null,
			changes: changes
				.filter(
					change =>
						change.title.trim() ||
						change.description.trim() ||
						change.image.trim() ||
						change.topicId,
				)
				.map(change => ({
					...(change.changeId ? { changeId: change.changeId } : {}),
					title: change.title,
					type: change.type,
					description: change.description,
					image: change.image,
					topicId: change.topicId,
				})),
		}),
		[title, description, version, releaseDateTime, changes],
	)
	const previewNote = useMemo(() => {
		const previewChanges = body.changes.map((change, index) => ({
			changeId: change.changeId ?? `preview-${index}`,
			title: change.title,
			type: change.type,
			description: change.description,
			image: change.image,
			topicName:
				topics.find(topic => topic.topicId === change.topicId)?.name ?? '',
		}))

		return {
			title,
			description,
			releaseDateTime: body.releaseDateTime,
			image: previewChanges.find(change => change.image)?.image ?? '',
			topicName:
				previewChanges.find(change => change.topicName)?.topicName ?? '',
			pinned: false,
			changes: previewChanges,
		}
	}, [body, title, description, topics])

	const patchChange = (clientId: string, patch: Partial<ChangeDraft>) => {
		setChanges(current =>
			current.map(change =>
				change.clientId === clientId ? { ...change, ...patch } : change,
			),
		)
	}

	const handleSave = async () => {
		setFeedback('')
		setFields({})

		if (isReadOnly) return

		if (!title.trim()) {
			setFields({ title: t('newsroom.titleRequired') })

			return
		}

		try {
			if (isNew) {
				const created = await createNote(body).unwrap()

				navigate(buildRoutePath.releaseNoteById(created.releaseNoteId), {
					replace: true,
				})

				return
			}

			await updateNote({
				releaseNoteId: releaseNoteId as string,
				body,
			}).unwrap()
		} catch (error: unknown) {
			setFields(apiFields(error))
			setFeedback(apiErrorMessage(error, t('newsroom.saveFailed')))
		}
	}

	const handlePublish = async () => {
		if (isNew || !releaseNoteId) return

		setFeedback('')
		setFields({})

		if (!isReadOnly) {
			if (!title.trim()) {
				setFields({ title: t('newsroom.titleRequired') })

				return
			}

			try {
				await updateNote({ releaseNoteId, body }).unwrap()
			} catch (error: unknown) {
				setFields(apiFields(error))
				setFeedback(apiErrorMessage(error, t('newsroom.saveFailed')))

				return
			}
		}

		try {
			await publishNote(releaseNoteId).unwrap()
		} catch (error: unknown) {
			setFields(apiFields(error))
			setFeedback(apiErrorMessage(error, t('newsroom.actionFailed')))
		}
	}

	const handleUnpublish = async () => {
		if (!releaseNoteId || isNew) return

		setFeedback('')
		setFields({})

		try {
			await unpublishNote(releaseNoteId).unwrap()
		} catch (error: unknown) {
			setFeedback(apiErrorMessage(error, t('newsroom.actionFailed')))
		}
	}

	const handleDuplicate = async () => {
		if (!releaseNoteId || isNew) return

		setFeedback('')
		setFields({})

		try {
			const copy = await duplicateNote(releaseNoteId).unwrap()

			navigate(buildRoutePath.releaseNoteById(copy.releaseNoteId))
		} catch (error: unknown) {
			setFeedback(apiErrorMessage(error, t('newsroom.actionFailed')))
		}
	}

	const handleDelete = async () => {
		if (!releaseNoteId || isNew) return

		if (!window.confirm(t('newsroom.deleteNoteConfirm'))) return

		setFeedback('')
		setFields({})

		try {
			await deleteNote(releaseNoteId).unwrap()
			navigate(RoutePaths.NEWSROOM_RELEASE_NOTES)
		} catch (error: unknown) {
			setFeedback(apiErrorMessage(error, t('newsroom.actionFailed')))
		}
	}

	const handleImageFile = async (
		clientId: string,
		event: ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0]

		event.target.value = ''

		if (!file) return

		if (file.size > MAX_IMAGE_BYTES) {
			setFeedback(t('newsroom.imageTooLarge'))

			return
		}

		try {
			patchChange(clientId, { image: await readFileAsDataUrl(file) })
		} catch {
			setFeedback(t('newsroom.imageReadFailed'))
		}
	}

	if (!isNew && isLoading) {
		return (
			<Container maxW="4xl" py={10}>
				<Spinner />
			</Container>
		)
	}

	if (!isNew && isError) {
		return (
			<Container maxW="4xl" py={10}>
				<Alert status="error" borderRadius="md">
					<AlertIcon />
					<AlertDescription>
						{apiErrorMessage(loadError, t('newsroom.editorLoadFailed'))}
					</AlertDescription>
				</Alert>
			</Container>
		)
	}

	return (
		<Container maxW="4xl" py={10}>
			<Stack gap={6}>
				<CustomBreadcrumb
					items={breadcrumbs[BreadCrumbItem.NEWSROOM_RELEASE_NOTE_EDITOR]}
				/>
				<Heading size="lg">
					{isNew ? t('newsroom.createNew') : t('newsroom.editNote')}
				</Heading>

				{isReadOnly ? (
					<Alert status="info" borderRadius="md">
						<AlertIcon />
						<AlertDescription>
							{t('newsroom.publishedReadOnly')}
						</AlertDescription>
					</Alert>
				) : null}

				{feedback ? (
					<Alert status="error" borderRadius="md">
						<AlertIcon />
						<AlertDescription>{feedback}</AlertDescription>
					</Alert>
				) : null}

				<Box
					as="fieldset"
					disabled={isReadOnly}
					border="0"
					p="0"
					m="0"
					minW="0"
				>
					<Stack gap={6}>
						<FormControl isInvalid={Boolean(fields.title)}>
							<FormLabel>{t('newsroom.noteTitle')}</FormLabel>
							<Input
								value={title}
								onChange={event => setTitle(event.target.value)}
							/>
							<FormErrorMessage>{fields.title}</FormErrorMessage>
						</FormControl>

						<Flex gap={4} wrap="wrap">
							<FormControl
								flex="1"
								minW="12rem"
								isInvalid={Boolean(fields.version)}
							>
								<FormLabel>{t('newsroom.version')}</FormLabel>
								<Input
									value={version}
									onChange={event => setVersion(event.target.value)}
								/>
								<FormErrorMessage>{fields.version}</FormErrorMessage>
							</FormControl>
							<FormControl
								flex="1"
								minW="16rem"
								isInvalid={Boolean(fields.releaseDateTime)}
							>
								<FormLabel>{t('newsroom.publicationDateTime')}</FormLabel>
								<Input
									type="datetime-local"
									value={releaseDateTime}
									onChange={event => setReleaseDateTime(event.target.value)}
								/>
								<FormErrorMessage>{fields.releaseDateTime}</FormErrorMessage>
							</FormControl>
						</Flex>

						<FormControl isInvalid={Boolean(fields.description)}>
							<FormLabel>{t('newsroom.description')}</FormLabel>
							<Textarea
								value={description}
								onChange={event => setDescription(event.target.value)}
								rows={4}
							/>
							<FormErrorMessage>{fields.description}</FormErrorMessage>
						</FormControl>

						<Box>
							<Flex justify="space-between" align="center" mb={3}>
								<Box>
									<Heading size="md">{t('newsroom.changes')}</Heading>
									{fields.changes ? (
										<Text color="red.500" fontSize="sm" mt={1}>
											{fields.changes}
										</Text>
									) : null}
								</Box>
								<Button
									leftIcon={<AddIcon />}
									size="sm"
									variant="outline"
									onClick={() =>
										setChanges(current => [...current, emptyChange()])
									}
								>
									{t('newsroom.addChange')}
								</Button>
							</Flex>

							<Stack gap={4}>
								{changes.map((change, index) => (
									<Box
										key={change.clientId}
										border="1px solid"
										borderColor="gray.200"
										borderRadius="lg"
										p={4}
									>
										<Flex justify="space-between" mb={3}>
											<Text fontWeight={700}>
												{t('newsroom.changeN', { n: index + 1 })}
											</Text>
											<Button
												size="xs"
												variant="ghost"
												colorScheme="red"
												onClick={() =>
													setChanges(current =>
														current.filter(
															item => item.clientId !== change.clientId,
														),
													)
												}
											>
												{t('common.delete')}
											</Button>
										</Flex>

										<Stack gap={3}>
											<FormControl
												isInvalid={Boolean(fields[`changes.${index}.title`])}
											>
												<FormLabel>{t('newsroom.changeTitle')}</FormLabel>
												<Input
													value={change.title}
													onChange={event =>
														patchChange(change.clientId, {
															title: event.target.value,
														})
													}
												/>
												<FormErrorMessage>
													{fields[`changes.${index}.title`]}
												</FormErrorMessage>
											</FormControl>

											<FormControl
												isInvalid={Boolean(fields[`changes.${index}.type`])}
											>
												<FormLabel>{t('newsroom.changeType')}</FormLabel>
												<RadioGroup
													value={change.type}
													isDisabled={isReadOnly}
													onChange={value =>
														patchChange(change.clientId, {
															type: value as ChangeDraft['type'],
														})
													}
												>
													<Stack>
														{CHANGE_TYPES.map(type => (
															<Box key={type}>
																<Radio value={type}>
																	{t(`newsroom.type.${type}`)}
																</Radio>
																<FormHelperText mt={0} ms={6}>
																	{t(`newsroom.typeHelp.${type}`)}
																</FormHelperText>
															</Box>
														))}
													</Stack>
												</RadioGroup>
											</FormControl>

											<FormControl
												isInvalid={Boolean(
													fields[`changes.${index}.description`],
												)}
											>
												<FormLabel>{t('newsroom.changeDescription')}</FormLabel>
												<Textarea
													value={change.description}
													onChange={event =>
														patchChange(change.clientId, {
															description: event.target.value,
														})
													}
													rows={3}
												/>
												<FormHelperText>
													{t('newsroom.changeDescriptionHelp')}
												</FormHelperText>
												<FormErrorMessage>
													{fields[`changes.${index}.description`]}
												</FormErrorMessage>
											</FormControl>

											<FormControl
												isInvalid={Boolean(fields[`changes.${index}.image`])}
											>
												<FormLabel>{t('newsroom.changeImage')}</FormLabel>
												<Input
													value={
														change.image.startsWith('data:') ? '' : change.image
													}
													onChange={event => {
														const image = event.target.value

														if (isOversizedNewsroomImage(image)) {
															setFeedback(t('newsroom.imageTooLarge'))

															return
														}

														setFeedback('')
														patchChange(change.clientId, { image })
													}}
													placeholder={t('newsroom.changeImageUrl')}
													mb={2}
												/>
												<Input
													type="file"
													accept="image/*"
													onChange={event =>
														void handleImageFile(change.clientId, event)
													}
												/>
												<FormHelperText>
													{t('newsroom.changeImageHelp')}
												</FormHelperText>
												<FormErrorMessage>
													{fields[`changes.${index}.image`]}
												</FormErrorMessage>
												{change.image ? (
													<Box>
														<Image
															src={change.image}
															alt=""
															maxH="160px"
															mt={3}
															borderRadius="md"
														/>
														<Button
															size="xs"
															mt={2}
															variant="outline"
															onClick={() =>
																patchChange(change.clientId, { image: '' })
															}
														>
															{t('newsroom.clearImage')}
														</Button>
													</Box>
												) : null}
											</FormControl>

											<FormControl
												isInvalid={Boolean(fields[`changes.${index}.topicId`])}
											>
												<FormLabel>{t('newsroom.topic')}</FormLabel>
												<Select
													sx={{
														'& + div': {
															left: '0.75rem',
															right: 'auto',
														},
													}}
													value={change.topicId}
													onChange={event =>
														patchChange(change.clientId, {
															topicId: event.target.value,
														})
													}
												>
													<option value="">{t('newsroom.selectTopic')}</option>
													{topics.map(topic => (
														<option key={topic.topicId} value={topic.topicId}>
															{topic.name}
														</option>
													))}
												</Select>
												<FormErrorMessage>
													{fields[`changes.${index}.topicId`]}
												</FormErrorMessage>
											</FormControl>
										</Stack>
									</Box>
								))}
							</Stack>
						</Box>
					</Stack>
				</Box>

				<Flex gap={3} wrap="wrap">
					<Button
						colorScheme="blue"
						onClick={() => void handleSave()}
						isLoading={isCreating || isUpdating}
						isDisabled={isReadOnly || isBusy}
					>
						{t('newsroom.saveDraft')}
					</Button>
					{!isNew && note?.status !== 'published' ? (
						<Button
							colorScheme="green"
							onClick={() => void handlePublish()}
							isLoading={isPublishing}
							isDisabled={isBusy}
						>
							{t('newsroom.publish')}
						</Button>
					) : null}
					{note?.status === 'published' ? (
						<Button
							onClick={() => void handleUnpublish()}
							isLoading={isUnpublishing}
							isDisabled={isBusy}
						>
							{t('newsroom.unpublish')}
						</Button>
					) : null}
					{!isNew ? (
						<Button
							onClick={() => void handleDuplicate()}
							isLoading={isDuplicating}
							isDisabled={isBusy}
						>
							{t('newsroom.duplicate')}
						</Button>
					) : null}
					{!isNew ? (
						<Button
							colorScheme="red"
							variant="outline"
							onClick={() => void handleDelete()}
							isLoading={isDeleting}
							isDisabled={isBusy}
						>
							{t('common.delete')}
						</Button>
					) : null}
					<Button variant="outline" onClick={preview.onOpen}>
						{t('newsroom.preview')}
					</Button>
					<Button
						variant="ghost"
						onClick={() => navigate(RoutePaths.NEWSROOM_RELEASE_NOTES)}
					>
						{t('common.cancel')}
					</Button>
				</Flex>
			</Stack>
			<Modal
				isOpen={preview.isOpen}
				onClose={preview.onClose}
				size="4xl"
				scrollBehavior="inside"
			>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>{t('newsroom.preview')}</ModalHeader>
					<ModalCloseButton />
					<ModalBody pb={6}>
						<Tabs>
							<TabList>
								<Tab>{t('newsroom.previewCard')}</Tab>
								<Tab>{t('newsroom.previewFull')}</Tab>
							</TabList>
							<TabPanels>
								<TabPanel px={0}>
									<NewsroomReleaseCard note={previewNote} pinDecorative />
								</TabPanel>
								<TabPanel px={0}>
									<NewsroomReleaseDetail note={previewNote} pinDecorative />
								</TabPanel>
							</TabPanels>
						</Tabs>
					</ModalBody>
				</ModalContent>
			</Modal>
		</Container>
	)
}

export default NewsroomReleaseNoteEditorPage
