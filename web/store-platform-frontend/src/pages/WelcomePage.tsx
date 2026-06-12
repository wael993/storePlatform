import { Box, Flex, Heading, Image, SimpleGrid, Stack, Text } from '@chakra-ui/react'

const infoItems = [
	{
		title: 'Manage your store',
		description: 'Keep products, suppliers, and customers organized in one place.',
	},
	{
		title: 'Track daily work',
		description: 'Follow sales, purchases, and daily actions with clear records.',
	},
	{
		title: 'Stay in control',
		description: 'Review invoices, users, and settings from a single platform.',
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
	return (
		<Flex sx={styles.wrapper}>
			<Stack sx={styles.card} gap={0}>
				<Flex sx={styles.hero}>
					<Stack align="center" maxW="42rem" gap={4}>
						<Flex sx={styles.logoWrap}>
							<Image
								src="/favicon.ico"
								alt="Store Platform"
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
							Store Platform
						</Text>
						<Heading
							color="gray.900"
							fontSize={{ base: '2rem', md: '3rem' }}
							lineHeight={1.1}
						>
							Welcome to your store workspace
						</Heading>
						<Text color="gray.600" fontSize={{ base: 'md', md: 'lg' }} maxW="34rem">
							Start your day with the tools you need to manage stock, sales,
							customers, suppliers, and store operations.
						</Text>
					</Stack>
				</Flex>

				<Box sx={styles.infoPanel}>
					<SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
						{infoItems.map(item => (
							<Stack key={item.title} sx={styles.infoItem} gap={2}>
								<Text color="gray.900" fontWeight={800}>
									{item.title}
								</Text>
								<Text color="gray.600" fontSize="sm" lineHeight="1.6">
									{item.description}
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
