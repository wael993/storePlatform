import { useEffect, useRef, useState } from 'react'
import {
	Box,
	Button,
	Flex,
	Heading,
	HStack,
	IconButton,
	Spinner,
	Text,
	Textarea,
	VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import CustomBreadcrumb from '../components/CustomBreadcrumb'
import { PAGE_COLORS } from '../components/SellingInvoice/constants'
import { usePostReportChatMutation } from '../api/apiStore'
import { BreadCrumbItem } from '../shared/globalEnums'
import { generateBreadcrumbs } from '../shared/routes'
import { BulbIcon } from '../shared/icons/Bulb'
import { PersonIcon } from '../shared/icons/Person'
import { SendIcon } from '../shared/icons/Send'
import { StarIcon } from '../shared/icons/Star'
import { pageContentMinHeight } from '../theme/layout'

const AI = {
	accent: '#6D28D9',
	accentSoft: '#EDE9FE',
	surface: 'linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 42%)',
	border: '#DDD6FE',
	userBubble: PAGE_COLORS.primary,
} as const

type ChatRole = 'user' | 'assistant'
type ChatMessage = { role: ChatRole; content: string }

const EXAMPLE_KEYS = [
	'report.chat.examples.bestSeller',
	'report.chat.examples.salesRange',
	'report.chat.examples.profit',
	'report.chat.examples.topSuppliers',
] as const

const ReportPage = () => {
	const { t } = useTranslation()
	const breadCrumbItems = generateBreadcrumbs()
	const [draft, setDraft] = useState('')
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [error, setError] = useState('')
	const bottomRef = useRef<HTMLDivElement>(null)
	const [postReportChat, { isLoading }] = usePostReportChatMutation()

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages, isLoading])

	const send = async (text: string) => {
		const content = text.trim()
		if (!content || isLoading) return

		const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }]
		setMessages(nextMessages)
		setDraft('')
		setError('')

		try {
			const { reply } = await postReportChat({
				messages: nextMessages.slice(-16),
			}).unwrap()
			setMessages([
				...nextMessages,
				{ role: 'assistant', content: reply.trim() },
			])
		} catch (err) {
			const failed = err as { data?: { message?: string } }
			setError(failed?.data?.message || t('report.chat.error'))
		}
	}

	return (
		<Flex flexDir="column" pb={4} minH={pageContentMinHeight}>
			<Flex flexDir="column" px={4}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.REPORTS]}
				/>
			</Flex>
			<Heading
				fontSize="1.5rem"
				fontWeight={700}
				mt="0.4rem"
				px={8}
				mb={{ base: 4, md: 6 }}
			>
				{t('components.pageHeaders.reports')}
			</Heading>

			<Flex
				flex="1"
				flexDir="column"
				minH={{ base: '28rem', md: '36rem' }}
				border="1px solid"
				borderColor={AI.border}
				borderRadius="1.25rem"
				overflow="hidden"
				bg={AI.surface}
				boxShadow="0 12px 32px rgba(109, 40, 217, 0.08)"
			>
				<HStack
					px={{ base: 4, md: 6 }}
					py={4}
					borderBottom="1px solid"
					borderColor={AI.border}
					bg="white"
					gap={3}
					align="flex-start"
				>
					<Flex
						boxSize={10}
						borderRadius="full"
						bg={AI.accentSoft}
						color={AI.accent}
						align="center"
						justify="center"
						flexShrink={0}
					>
						<StarIcon boxSize={5} />
					</Flex>
					<Box>
						<Text fontWeight={800} color="gray.900">
							{t('report.chat.title')}
						</Text>
						<Text fontSize="sm" color={PAGE_COLORS.muted}>
							{t('report.chat.subtitle')}
						</Text>
					</Box>
				</HStack>

				<VStack
					flex="1"
					overflowY="auto"
					px={{ base: 4, md: 6 }}
					py={5}
					gap={4}
					align="stretch"
				>
					{messages.length === 0 && !isLoading && (
						<Flex
							flex="1"
							align="center"
							justify="center"
							flexDir="column"
							gap={4}
							py={8}
							textAlign="center"
						>
							<Flex
								boxSize={14}
								borderRadius="1rem"
								bg={AI.accentSoft}
								color={AI.accent}
								align="center"
								justify="center"
							>
								<BulbIcon boxSize={7} />
							</Flex>
							<Text fontWeight={700} color="gray.800">
								{t('report.chat.empty')}
							</Text>
							<Text fontSize="sm" color={PAGE_COLORS.muted} maxW="28rem">
								{t('report.chat.emptyHint')}
							</Text>
							<Flex gap={2} flexWrap="wrap" justify="center">
								{EXAMPLE_KEYS.map(key => (
									<Button
										key={key}
										size="sm"
										variant="outline"
										borderColor={AI.border}
										color={AI.accent}
										bg="white"
										fontWeight={600}
										onClick={() => setDraft(t(key))}
									>
										{t(key)}
									</Button>
								))}
							</Flex>
						</Flex>
					)}

					{messages.map((message, index) => {
						const isUser = message.role === 'user'

						return (
							<Flex
								key={`${message.role}-${index}`}
								justify={isUser ? 'flex-end' : 'flex-start'}
								gap={2}
								align="flex-end"
							>
								{!isUser && (
									<Flex
										boxSize={8}
										borderRadius="full"
										bg={AI.accentSoft}
										color={AI.accent}
										align="center"
										justify="center"
										flexShrink={0}
									>
										<StarIcon boxSize={4} />
									</Flex>
								)}
								<Box
									maxW={{ base: '88%', md: '72%' }}
									px={4}
									py={3}
									borderRadius="1rem"
									borderBottomRightRadius={isUser ? '0.25rem' : '1rem'}
									borderBottomLeftRadius={isUser ? '1rem' : '0.25rem'}
									bg={isUser ? AI.userBubble : 'white'}
									color={isUser ? 'white' : 'gray.800'}
									border={isUser ? 'none' : '1px solid'}
									borderColor={AI.border}
									whiteSpace="pre-wrap"
									fontSize="sm"
									lineHeight="1.6"
								>
									{message.content}
								</Box>
								{isUser && (
									<Flex
										boxSize={8}
										borderRadius="full"
										bg="blue.50"
										color={PAGE_COLORS.primary}
										align="center"
										justify="center"
										flexShrink={0}
									>
										<PersonIcon boxSize={4} />
									</Flex>
								)}
							</Flex>
						)
					})}

					{isLoading && (
						<HStack color={AI.accent} fontSize="sm" fontWeight={600}>
							<Spinner size="sm" color={AI.accent} />
							<Text>{t('report.chat.thinking')}</Text>
						</HStack>
					)}

					{error && (
						<Text fontSize="sm" color={PAGE_COLORS.danger}>
							{error}
						</Text>
					)}
					<Box ref={bottomRef} />
				</VStack>

				<HStack
					px={{ base: 3, md: 4 }}
					py={3}
					borderTop="1px solid"
					borderColor={AI.border}
					bg="white"
					gap={2}
					align="flex-end"
				>
					<Textarea
						value={draft}
						onChange={event => setDraft(event.target.value)}
						placeholder={t('report.chat.placeholder')}
						minH="2.75rem"
						maxH="8rem"
						rows={1}
						resize="none"
						borderColor={AI.border}
						_focus={{
							borderColor: AI.accent,
							boxShadow: '0 0 0 1px #6D28D9',
						}}
						onKeyDown={event => {
							if (event.key === 'Enter' && !event.shiftKey) {
								event.preventDefault()
								void send(draft)
							}
						}}
					/>
					<IconButton
						aria-label={t('report.chat.send')}
						icon={<SendIcon boxSize={4} />}
						bg={AI.accent}
						color="white"
						flexShrink={0}
						isDisabled={!draft.trim() || isLoading}
						isLoading={isLoading}
						onClick={() => void send(draft)}
						_hover={{ bg: '#5B21B6' }}
					/>
				</HStack>
			</Flex>
		</Flex>
	)
}

export default ReportPage
