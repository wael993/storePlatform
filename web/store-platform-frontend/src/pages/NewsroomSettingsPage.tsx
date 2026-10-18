import { useState } from 'react'
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
	useCreateNewsroomTopicMutation,
	useDeleteNewsroomTopicMutation,
	useGetNewsroomTopicsQuery,
	useUpdateNewsroomTopicMutation,
} from '../api/apiStore'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { BreadCrumbItem } from '../shared/globalEnums'
import { generateBreadcrumbs } from '../shared/routes'

const apiErrorMessage = (error: unknown, fallback: string): string =>
	typeof error === 'object' &&
	error !== null &&
	'data' in error &&
	typeof (error as { data?: { message?: unknown } }).data?.message === 'string'
		? (error as { data: { message: string } }).data.message
		: fallback

const NewsroomSettingsPage = () => {
	const { t } = useTranslation()
	const breadcrumbs = generateBreadcrumbs()
	const {
		data: topics = [],
		isLoading,
		isError,
		error: loadError,
	} = useGetNewsroomTopicsQuery()
	const [createTopic, { isLoading: isCreating }] =
		useCreateNewsroomTopicMutation()
	const [updateTopic, { isLoading: isUpdating }] =
		useUpdateNewsroomTopicMutation()
	const [deleteTopic, { isLoading: isDeleting }] =
		useDeleteNewsroomTopicMutation()
	const [newName, setNewName] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingName, setEditingName] = useState('')
	const [feedback, setFeedback] = useState('')

	const isBusy = isLoading || isCreating || isUpdating || isDeleting

	const handleCreate = async () => {
		setFeedback('')

		try {
			await createTopic({ name: newName }).unwrap()
			setNewName('')
		} catch (error: unknown) {
			setFeedback(apiErrorMessage(error, t('newsroom.topicSaveFailed')))
		}
	}

	const handleSaveEdit = async () => {
		if (!editingId) return

		setFeedback('')

		try {
			await updateTopic({ topicId: editingId, name: editingName }).unwrap()
			setEditingId(null)
			setEditingName('')
		} catch (error: unknown) {
			setFeedback(apiErrorMessage(error, t('newsroom.topicSaveFailed')))
		}
	}

	const handleDelete = async (topicId: string) => {
		if (!window.confirm(t('newsroom.deleteConfirm'))) return

		setFeedback('')

		try {
			await deleteTopic(topicId).unwrap()
		} catch (error: unknown) {
			setFeedback(apiErrorMessage(error, t('newsroom.topicDeleteFailed')))
		}
	}

	return (
		<Container maxW="4xl" py={10}>
			<Stack gap={6}>
				<CustomBreadcrumb
					items={breadcrumbs[BreadCrumbItem.NEWSROOM_SETTINGS]}
				/>
				<Box>
					<Heading size="lg">{t('newsroom.settingsTitle')}</Heading>
					<Text color="gray.600" mt={2}>
						{t('newsroom.settingsDescription')}
					</Text>
				</Box>

				{feedback || isError ? (
					<Alert status="error" borderRadius="md">
						<AlertIcon />
						<AlertDescription>
							{feedback ||
								apiErrorMessage(loadError, t('newsroom.topicLoadFailed'))}
						</AlertDescription>
					</Alert>
				) : null}

				<Flex gap={3} align="flex-end">
					<Box flex="1">
						<Text fontSize="sm" fontWeight={600} mb={1}>
							{t('newsroom.topicName')}
						</Text>
						<Input
							value={newName}
							onChange={event => setNewName(event.target.value)}
							placeholder={t('newsroom.topicNamePlaceholder')}
						/>
					</Box>
					<Button
						colorScheme="blue"
						onClick={() => void handleCreate()}
						isLoading={isCreating}
						isDisabled={!newName.trim() || isBusy}
					>
						{t('newsroom.addTopic')}
					</Button>
				</Flex>

				{isLoading ? (
					<Spinner />
				) : isError ? null : topics.length === 0 ? (
					<Text color="gray.500">{t('newsroom.topicsEmpty')}</Text>
				) : (
					<Table size="sm">
						<Thead>
							<Tr>
								<Th>{t('newsroom.topicName')}</Th>
								<Th w="12rem">{t('newsroom.actions')}</Th>
							</Tr>
						</Thead>
						<Tbody>
							{topics.map(topic => (
								<Tr key={topic.topicId}>
									<Td>
										{editingId === topic.topicId ? (
											<Input
												value={editingName}
												onChange={event => setEditingName(event.target.value)}
												size="sm"
											/>
										) : (
											topic.name
										)}
									</Td>
									<Td>
										{editingId === topic.topicId ? (
											<Flex gap={2}>
												<Button
													size="sm"
													colorScheme="blue"
													onClick={() => void handleSaveEdit()}
													isDisabled={!editingName.trim() || isBusy}
												>
													{t('common.save')}
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => {
														setEditingId(null)
														setEditingName('')
													}}
												>
													{t('common.cancel')}
												</Button>
											</Flex>
										) : (
											<Flex gap={2}>
												<Button
													size="sm"
													variant="outline"
													onClick={() => {
														setEditingId(topic.topicId)
														setEditingName(topic.name)
														setFeedback('')
													}}
												>
													{t('newsroom.edit')}
												</Button>
												<Button
													size="sm"
													variant="outline"
													colorScheme="red"
													onClick={() => void handleDelete(topic.topicId)}
													isDisabled={isBusy}
												>
													{t('common.delete')}
												</Button>
											</Flex>
										)}
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

export default NewsroomSettingsPage
