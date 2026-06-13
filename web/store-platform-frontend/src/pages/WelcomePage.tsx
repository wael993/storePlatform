import { Box, Flex, Heading, Image, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'

const infoItems = [
	{
		titleKey: 'welcome.cards.manage.title',
		descriptionKey: 'welcome.cards.manage.description',
	},
	{
		titleKey: 'welcome.cards.track.title',
		descriptionKey: 'welcome.cards.track.description',
	},
	{
		titleKey: 'welcome.cards.control.title',
		descriptionKey: 'welcome.cards.control.description',
	},
]

const styles = {
	wrapper: {
		minH: 'calc(100vh - 11rem)',
		alignItems: 'center',
		justifyContent: 'center',
		px: { base: 2, md: 6 },
	},
	card: {
		width: '100%',
		maxW: '66rem',
		bg: 'white',
		borderRadius: '2rem',
		boxShadow: '0 24px 80px rgba(15, 23, 42, 0.12)',
		overflow: 'hidden',
		border: '1px solid',
		borderColor: 'gray.100',
	},
	hero: {
		alignItems: 'center',
		justifyContent: 'center',
		bg: 'linear-gradient(135deg, #EBF8FF 0%, #F7FAFC 55%, #FFFFFF 100%)',
		px: { base: 8, md: 14 },
		py: { base: 10, md: 16 },
		textAlign: 'center',
	},
	logoWrap: {
		width: { base: '8rem', md: '10rem' },
		height: { base: '8rem', md: '10rem' },
		alignItems: 'center',
		justifyContent: 'center',
		bg: 'white',
		borderRadius: '2rem',
		boxShadow: '0 18px 45px rgba(49, 130, 206, 0.18)',
		mb: 8,
	},
	infoPanel: {
		px: { base: 6, md: 10 },
		py: { base: 8, md: 10 },
	},
	infoItem: {
		border: '1px solid',
		borderColor: 'gray.100',
		borderRadius: '1.25rem',
		p: 5,
		bg: 'gray.50',
	},
} satisfies StylesObject

const WelcomePage = () => {
	const { t } = useTranslation()

	return (
		<Flex sx={styles.wrapper}>
			<Stack sx={styles.card} gap={0}>
				<Flex sx={styles.hero}>
					<Stack align="center" maxW="42rem" gap={4}>
						<Flex sx={styles.logoWrap}>
							<Image
								src="/favicon.ico"
								alt={t('components.topBar.logoAlt')}
								w={{ base: '4.5rem', md: '5.5rem' }}
								h={{ base: '4.5rem', md: '5.5rem' }}
								objectFit="contain"
							/>
						</Flex>
						<Text
							color="blue.600"
							fontSize="sm"
							fontWeight={800}
							letterSpacing="0.14em"
							textTransform="uppercase"
						>
							{t('appTitle')}
						</Text>
						<Heading
							color="gray.900"
							fontSize={{ base: '2rem', md: '3rem' }}
							lineHeight={1.1}
						>
							{t('welcome.title')}
						</Heading>
						<Text color="gray.600" fontSize={{ base: 'md', md: 'lg' }} maxW="34rem">
							{t('welcome.subtitle')}
						</Text>
					</Stack>
				</Flex>

				<Box sx={styles.infoPanel}>
					<SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
						{infoItems.map(item => (
							<Stack key={item.titleKey} sx={styles.infoItem} gap={2}>
								<Text color="gray.900" fontWeight={800}>
									{t(item.titleKey)}
								</Text>
								<Text color="gray.600" fontSize="sm" lineHeight="1.6">
									{t(item.descriptionKey)}
								</Text>
							</Stack>
						))}
					</SimpleGrid>
				</Box>
			</Stack>
		</Flex>
	)
}

export default WelcomePage
