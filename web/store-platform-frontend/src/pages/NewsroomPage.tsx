import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Box,
	Button,
	Container,
	Flex,
	Heading,
	Input,
	Select,
	Spinner,
	Stack,
	Switch,
	Text,
} from '@chakra-ui/react'
import { CloseIcon } from '@chakra-ui/icons'
import { useTranslation } from 'react-i18next'

import {
	NewsroomFeedFilters,
	useGetNewsroomFeedItemQuery,
	useGetNewsroomFeedQuery,
	useGetNewsroomTopicsQuery,
	usePinNewsroomItemMutation,
	useUnpinNewsroomItemMutation,
	useVisitNewsroomMutation,
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

const apiErrorMessage = (error: unknown, fallback: string): string =>
	typeof error === 'object' &&
	error !== null &&
	'data' in error &&
	typeof (error as { data?: { message?: unknown } }).data?.message === 'string'
		? (error as { data: { message: string } }).data.message
		: fallback

const NewsroomPage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { releaseNoteId } = useParams<{ releaseNoteId: string }>()
	const [title, setTitle] = useState('')
	const [titleFilter, setTitleFilter] = useState('')
	const [topicId, setTopicId] = useState('')
	const [pinnedOnly, setPinnedOnly] = useState(false)
	const [feedback, setFeedback] = useState('')
	const filters = useMemo<NewsroomFeedFilters>(() => {
		const next: NewsroomFeedFilters = {}

		if (titleFilter) next.title = titleFilter

		if (topicId) next.topicId = topicId

		if (pinnedOnly) next.pinned = true

		return next
	}, [titleFilter, topicId, pinnedOnly])
	const { data: topics = [] } = useGetNewsroomTopicsQuery(undefined, {
		skip: Boolean(releaseNoteId),
	})
	const {
		data: notes = [],
		isLoading: isFeedLoading,
		isError: isFeedError,
		error: feedError,
	} = useGetNewsroomFeedQuery(filters, { skip: Boolean(releaseNoteId) })
	const {
		data: detail,
		isLoading: isDetailLoading,
		isError: isDetailError,
		error: detailError,
	} = useGetNewsroomFeedItemQuery(releaseNoteId ?? '', {
		skip: !releaseNoteId,
	})
	const [visitNewsroom] = useVisitNewsroomMutation()
	const [pinItem] = usePinNewsroomItemMutation()
	const [unpinItem] = useUnpinNewsroomItemMutation()
	const breadcrumbs = generateBreadcrumbs({
		name: releaseNoteId ? detail?.title || t('newsroom.title') : undefined,
	})

	useEffect(() => {
		const timer = window.setTimeout(() => setTitleFilter(title.trim()), 300)

		return () => window.clearTimeout(timer)
	}, [title])

	useEffect(() => {
		if (releaseNoteId) return

		void visitNewsroom()
			.unwrap()
			.catch((error: unknown) => {
				setFeedback(apiErrorMessage(error, t('newsroom.actionFailed')))
			})
	}, [releaseNoteId, visitNewsroom, t])

	const togglePin = async (id: string, pinned?: boolean) => {
		try {
			await (pinned ? unpinItem(id) : pinItem(id)).unwrap()
		} catch (error: unknown) {
			setFeedback(apiErrorMessage(error, t('newsroom.actionFailed')))
		}
	}

	return (
		<Container maxW="4xl" py={8}>
			<Stack gap={6}>
				<Flex justify="space-between" align="center" gap={4} wrap="wrap">
					<CustomBreadcrumb items={breadcrumbs[BreadCrumbItem.NEWSROOM]} />
					<Button
						leftIcon={<CloseIcon boxSize={2.5} />}
						variant="ghost"
						onClick={() =>
							navigate(releaseNoteId ? RoutePaths.NEWSROOM : RoutePaths.ROOT)
						}
					>
						{t('newsroom.close')}
					</Button>
				</Flex>
				<Heading size="lg">
					{releaseNoteId
						? (detail?.title ?? t('newsroom.title'))
						: t('newsroom.title')}
				</Heading>
				{feedback ? (
					<Alert status="error" borderRadius="md">
						<AlertIcon />
						<AlertDescription>{feedback}</AlertDescription>
					</Alert>
				) : null}

				{releaseNoteId ? (
					isDetailLoading ? (
						<Spinner />
					) : isDetailError || !detail ? (
						<Alert status="error" borderRadius="md">
							<AlertIcon />
							<AlertDescription>
								{apiErrorMessage(detailError, t('newsroom.itemNotFound'))}
							</AlertDescription>
						</Alert>
					) : (
						<NewsroomReleaseDetail
							note={detail}
							onTogglePin={() => togglePin(detail.releaseNoteId, detail.pinned)}
						/>
					)
				) : (
					<>
						<Flex gap={3} wrap="wrap" align="center">
							<Input
								maxW="16rem"
								value={title}
								onChange={event => setTitle(event.target.value)}
								placeholder={t('newsroom.search')}
							/>
							<Select
								maxW="14rem"
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
							<Flex align="center" gap={2}>
								<Switch
									isChecked={pinnedOnly}
									onChange={event => setPinnedOnly(event.target.checked)}
								/>
								<Text fontSize="sm">{t('newsroom.pinnedOnly')}</Text>
							</Flex>
						</Flex>
						{isFeedError ? (
							<Alert status="error" borderRadius="md">
								<AlertIcon />
								<AlertDescription>
									{apiErrorMessage(feedError, t('newsroom.feedLoadFailed'))}
								</AlertDescription>
							</Alert>
						) : isFeedLoading ? (
							<Spinner />
						) : notes.length === 0 ? (
							<Text color="gray.500">{t('newsroom.feedEmpty')}</Text>
						) : (
							<Stack gap={4}>
								{notes.map(note => (
									<Box key={note.releaseNoteId}>
										<NewsroomReleaseCard
											note={note}
											onReadMore={() =>
												navigate(
													buildRoutePath.newsroomItem(note.releaseNoteId),
												)
											}
											onTogglePin={() =>
												togglePin(note.releaseNoteId, note.pinned)
											}
										/>
									</Box>
								))}
							</Stack>
						)}
					</>
				)}
			</Stack>
		</Container>
	)
}

export default NewsroomPage
