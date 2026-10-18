import {
	Badge,
	Box,
	Button,
	Flex,
	Heading,
	IconButton,
	Image,
	Stack,
	Text,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

import { StarIcon } from '../../shared/icons/Star'

export type NewsroomChangeViewModel = {
	changeId: string
	title: string
	type: string
	description: string
	image: string
	topicName: string
}

export type NewsroomCardModel = {
	title: string
	description: string
	releaseDateTime: string | null
	image: string
	topicName: string
	pinned?: boolean
}

export type NewsroomDetailModel = NewsroomCardModel & {
	changes: NewsroomChangeViewModel[]
}

export const clipNewsroomDescription = (text: string, words = 30): string => {
	const parts = text.trim().split(/\s+/).filter(Boolean)

	if (parts.length <= words) return text.trim()

	return `${parts.slice(0, words).join(' ')}…`
}

export const formatNewsroomDateTime = (
	value: string | null,
	locale: string,
): string => {
	if (!value) return '—'

	const date = new Date(value)

	return Number.isNaN(date.getTime())
		? '—'
		: date.toLocaleString(locale, {
				dateStyle: 'medium',
				timeStyle: 'short',
			})
}

type PinButtonProps = {
	pinned?: boolean
	decorative?: boolean
	onTogglePin?: () => void
}

const PinButton = ({ pinned, decorative, onTogglePin }: PinButtonProps) => {
	const { t } = useTranslation()

	return (
		<IconButton
			aria-label={pinned ? t('newsroom.unpin') : t('newsroom.pin')}
			icon={<StarIcon boxSize={5} />}
			size="sm"
			variant="ghost"
			color={pinned ? 'yellow.400' : 'gray.400'}
			isDisabled={decorative}
			onClick={event => {
				event.stopPropagation()
				onTogglePin?.()
			}}
		/>
	)
}

export const NewsroomReleaseCard = ({
	note,
	onReadMore,
	onTogglePin,
	pinDecorative,
}: {
	note: NewsroomCardModel
	onReadMore?: () => void
	onTogglePin?: () => void
	pinDecorative?: boolean
}) => {
	const { t, i18n } = useTranslation()

	return (
		<Box
			border="1px solid"
			borderColor="gray.200"
			borderRadius="xl"
			overflow="hidden"
			bg="white"
		>
			{note.image ? (
				<Image
					src={note.image}
					alt=""
					w="100%"
					maxH="220px"
					objectFit="cover"
				/>
			) : null}
			<Stack p={4} gap={3}>
				<Flex justify="space-between" align="flex-start" gap={3}>
					{note.topicName ? (
						<Badge colorScheme="blue">{note.topicName}</Badge>
					) : (
						<Box />
					)}
					<PinButton
						pinned={note.pinned}
						decorative={pinDecorative}
						onTogglePin={onTogglePin}
					/>
				</Flex>
				<Heading size="md">{note.title || t('newsroom.untitled')}</Heading>
				<Text fontSize="sm" color="gray.500">
					{formatNewsroomDateTime(note.releaseDateTime, i18n.language)}
				</Text>
				{note.description ? (
					<Text noOfLines={3} color="gray.700">
						{clipNewsroomDescription(note.description)}
					</Text>
				) : null}
				<Button
					alignSelf="flex-start"
					variant="link"
					colorScheme="blue"
					onClick={onReadMore}
				>
					{t('newsroom.readMore')}
				</Button>
			</Stack>
		</Box>
	)
}

export const NewsroomReleaseDetail = ({
	note,
	onTogglePin,
	pinDecorative,
}: {
	note: NewsroomDetailModel
	onTogglePin?: () => void
	pinDecorative?: boolean
}) => {
	const { t, i18n } = useTranslation()

	return (
		<Stack gap={6}>
			<Flex justify="space-between" align="flex-start" gap={3}>
				<Box>
					<Heading size="lg">{note.title || t('newsroom.untitled')}</Heading>
					<Text mt={2} color="gray.500">
						{formatNewsroomDateTime(note.releaseDateTime, i18n.language)}
					</Text>
				</Box>
				<PinButton
					pinned={note.pinned}
					decorative={pinDecorative}
					onTogglePin={onTogglePin}
				/>
			</Flex>
			{note.description ? (
				<Text whiteSpace="pre-wrap">{note.description}</Text>
			) : null}
			<Stack gap={6}>
				{note.changes.map(change => (
					<Box
						key={change.changeId}
						border="1px solid"
						borderColor="gray.200"
						borderRadius="lg"
						p={4}
					>
						<Flex gap={2} wrap="wrap" mb={2}>
							{change.type ? (
								<Badge>{t(`newsroom.type.${change.type}`)}</Badge>
							) : null}
							{change.topicName ? (
								<Badge colorScheme="blue">{change.topicName}</Badge>
							) : null}
						</Flex>
						<Heading size="sm" mb={2}>
							{change.title}
						</Heading>
						{change.image ? (
							<Image
								src={change.image}
								alt=""
								maxH="240px"
								borderRadius="md"
								mb={3}
							/>
						) : null}
						<Text whiteSpace="pre-wrap">{change.description}</Text>
					</Box>
				))}
			</Stack>
		</Stack>
	)
}
