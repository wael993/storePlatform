import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Button,
	Container,
	Flex,
	Heading,
	Input,
	Select,
	Spinner,
	Stack,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

import {
	NewsroomReleaseNoteFilters,
	useDeleteNewsroomReleaseNoteMutation,
	useDuplicateNewsroomReleaseNoteMutation,
	useGetNewsroomReleaseNotesQuery,
	useGetNewsroomTopicsQuery,
	usePublishNewsroomReleaseNoteMutation,
	useUnpublishNewsroomReleaseNoteMutation,
} from '../api/apiStore'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { BreadCrumbItem } from '../shared/globalEnums'
import {
	generateBreadcrumbs,
	RoutePaths,
	buildRoutePath,
} from '../shared/routes'

const apiErrorMessage = (error: unknown, fallback: string): string =>
	typeof error === 'object' &&
	error !== null &&
	'data' in error &&
	typeof (error as { data?: { message?: unknown } }).data?.message === 'string'
		? (error as { data: { message: string } }).data.message
		: fallback

const STATUSES = ['draft', 'published', 'unpublished'] as const

const NewsroomReleaseNotesPage = () => {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()
	const breadcrumbs = generateBreadcrumbs()
	const [title, setTitle] = useState('')
	const [titleFilter, setTitleFilter] = useState('')
	const [status, setStatus] = useState('')
	const [releaseDate, setReleaseDate] = useState('')
	const [topicId, setTopicId] = useState('')
	const filters = useMemo<NewsroomReleaseNoteFilters>(() => {
		const next: NewsroomReleaseNoteFilters = {}

		if (titleFilter) next.title = titleFilter

		if (status) next.status = status

		if (releaseDate) next.releaseDate = releaseDate

		if (topicId) next.topicId = topicId

		return next
	}, [titleFilter, status, releaseDate, topicId])

	useEffect(() => {
		const timer = window.setTimeout(() => setTitleFilter(title.trim()), 300)

		return () => window.clearTimeout(timer)
	}, [title])

	const {
		data: notes = [],
		isLoading,
		isError,
		error,
	} = useGetNewsroomReleaseNotesQuery(filters)
	const { data: topics = [] } = useGetNewsroomTopicsQuery()
	const [publishNote, { isLoading: isPublishing }] =
		usePublishNewsroomReleaseNoteMutation()
	const [unpublishNote, { isLoading: isUnpublishing }] =
		useUnpublishNewsroomReleaseNoteMutation()
	const [duplicateNote, { isLoading: isDuplicating }] =
		useDuplicateNewsroomReleaseNoteMutation()
	const [deleteNote, { isLoading: isDeleting }] =
		useDeleteNewsroomReleaseNoteMutation()
	const [feedback, setFeedback] = useState('')
	const isBusy = isPublishing || isUnpublishing || isDuplicating || isDeleting

	const runAction = async (
		action: 'publish' | 'unpublish' | 'duplicate' | 'delete',
		releaseNoteId: string,
	) => {
		setFeedback('')

		try {
			if (action === 'delete') {
				if (!window.confirm(t('newsroom.deleteNoteConfirm'))) return

				await deleteNote(releaseNoteId).unwrap()

				return
			}

			if (action === 'duplicate') {
				const copy = await duplicateNote(releaseNoteId).unwrap()

				navigate(buildRoutePath.releaseNoteById(copy.releaseNoteId))

				return
			}

			if (action === 'publish') {
				await publishNote(releaseNoteId).unwrap()

				return
			}

			await unpublishNote(releaseNoteId).unwrap()
		} catch (error: unknown) {
			setFeedback(apiErrorMessage(error, t('newsroom.actionFailed')))
		}
	}

	const formatDate = (value: string | null) => {
		if (!value) return '—'

		const date = new Date(value)

		return Number.isNaN(date.getTime())
			? '—'
			: date.toLocaleString(i18n.language)
	}

	return (
		<Container maxW="6xl" py={10}>
			<Stack gap={6}>
				<CustomBreadcrumb
					items={breadcrumbs[BreadCrumbItem.NEWSROOM_RELEASE_NOTES]}
				/>
				<Flex justify="space-between" align="center" gap={4} wrap="wrap">
					<Heading size="lg">{t('newsroom.releaseNotes')}</Heading>
					<Button
						colorScheme="blue"
						onClick={() => navigate(RoutePaths.NEWSROOM_RELEASE_NOTE_NEW)}
					>
						{t('newsroom.createNew')}
					</Button>
				</Flex>

				<Flex gap={3} wrap="wrap">
					<Input
						maxW="16rem"
						value={title}
						onChange={event => setTitle(event.target.value)}
						placeholder={t('newsroom.titleFilter')}
					/>
					<Select
						maxW="12rem"
						sx={{
							'& + div': {
								left: '0.75rem',
								right: 'auto',
							},
						}}
						value={status}
						onChange={event => setStatus(event.target.value)}
					>
						<option value="">{t('newsroom.allStatuses')}</option>
						{STATUSES.map(value => (
							<option key={value} value={value}>
								{t(`newsroom.status.${value}`)}
							</option>
						))}
					</Select>
					<Input
						maxW="12rem"
						type="date"
						value={releaseDate}
						onChange={event => setReleaseDate(event.target.value)}
					/>
					<Select
						maxW="14rem"
						sx={{
							'& + div': {
								left: '0.75rem',
								right: 'auto',
							},
						}}
						value={topicId}
						onChange={event => setTopicId(event.target.value)}
					>
						<option value="">{t('newsroom.allTopics')}</option>
						{topics.map(topic => (
							<option key={topic.topicId} value={topic.topicId}>
								{topic.name}
							</option>
						))}
					</Select>
				</Flex>

				{isError || feedback ? (
					<Alert status="error" borderRadius="md">
						<AlertIcon />
						<AlertDescription>
							{feedback || apiErrorMessage(error, t('newsroom.listLoadFailed'))}
						</AlertDescription>
					</Alert>
				) : null}

				{isLoading ? (
					<Spinner />
				) : isError ? null : notes.length === 0 ? (
					<Text color="gray.500">{t('newsroom.listEmpty')}</Text>
				) : (
					<Table size="sm">
						<Thead>
							<Tr>
								<Th>{t('newsroom.noteTitle')}</Th>
								<Th>{t('newsroom.statusLabel')}</Th>
								<Th>{t('newsroom.releaseDate')}</Th>
								<Th>{t('newsroom.topic')}</Th>
								<Th>{t('newsroom.actions')}</Th>
							</Tr>
						</Thead>
						<Tbody>
							{notes.map(note => (
								<Tr
									key={note.releaseNoteId}
									cursor="pointer"
									_hover={{ bg: 'gray.50' }}
									onClick={() =>
										navigate(buildRoutePath.releaseNoteById(note.releaseNoteId))
									}
								>
									<Td>{note.title}</Td>
									<Td>{t(`newsroom.status.${note.status}`)}</Td>
									<Td>{formatDate(note.releaseDateTime)}</Td>
									<Td>
										{note.topics.length
											? note.topics.map(topic => topic.name).join(', ')
											: '—'}
									</Td>
									<Td onClick={event => event.stopPropagation()}>
										<Flex gap={1} wrap="wrap">
											{note.status === 'published' ? (
												<Button
													size="xs"
													isDisabled={isBusy}
													onClick={() =>
														void runAction('unpublish', note.releaseNoteId)
													}
												>
													{t('newsroom.unpublish')}
												</Button>
											) : (
												<Button
													size="xs"
													colorScheme="blue"
													isDisabled={isBusy}
													onClick={() =>
														void runAction('publish', note.releaseNoteId)
													}
												>
													{t('newsroom.publish')}
												</Button>
											)}
											<Button
												size="xs"
												isDisabled={isBusy}
												onClick={() =>
													void runAction('duplicate', note.releaseNoteId)
												}
											>
												{t('newsroom.duplicate')}
											</Button>
											<Button
												size="xs"
												colorScheme="red"
												variant="ghost"
												isDisabled={isBusy}
												onClick={() =>
													void runAction('delete', note.releaseNoteId)
												}
											>
												{t('common.delete')}
											</Button>
										</Flex>
									</Td>
								</Tr>
							))}
						</Tbody>
					</Table>
				)}
			</Stack>
		</Container>
	)
}

export default NewsroomReleaseNotesPage
