import { Box, Center, Flex, Icon, Text } from '@chakra-ui/react'
import { AsSearchIcon } from '../../icons/Search'

const styles = {
	wrapper: {
		width: '100%',
		padding: { base: '2rem 1rem', md: '3rem 1.5rem' },
	},
	card: {
		width: '100%',
		maxWidth: '32rem',
		minHeight: '15rem',
		alignItems: 'center',
		justifyContent: 'center',
		flexDir: 'column',
		gap: '1rem',
		textAlign: 'center',
		border: '1px dashed #D9DEE8',
		borderRadius: '1.5rem',
		background:
			'linear-gradient(180deg, rgba(247, 250, 252, 0.92) 0%, #FFFFFF 100%)',
		boxShadow: '0 1rem 2.5rem rgba(15, 23, 42, 0.06)',
		px: { base: '1.5rem', md: '2.5rem' },
		py: { base: '2rem', md: '2.75rem' },
	},
	iconWrapper: {
		width: '4rem',
		height: '4rem',
		borderRadius: '50%',
		background: '#F0F5FF',
		color: '#3D6AFF',
		boxShadow: 'inset 0 0 0 0.5rem rgba(61, 106, 255, 0.08)',
	},
	icon: {
		width: '1.75rem',
		height: '1.75rem',
	},
	title: {
		color: '#1A202C',
		fontSize: { base: '1rem', md: '1.125rem' },
		fontWeight: '700',
	},
	description: {
		color: '#6F6F6F',
		fontSize: '0.875rem',
		lineHeight: '1.5',
		maxWidth: '22rem',
		marginTop: '0.5rem',
	},
} satisfies StylesObject

interface EmptyStateProps {
	title: string
	description?: string
}

const EmptyState = ({ title, description }: EmptyStateProps) => {
	return (
		<Center sx={styles.wrapper}>
			<Flex sx={styles.card}>
				<Center sx={styles.iconWrapper}>
					<Icon as={AsSearchIcon} sx={styles.icon} />
				</Center>
				<Box>
					<Text sx={styles.title}>{title}</Text>
					{description && <Text sx={styles.description}>{description}</Text>}
				</Box>
			</Flex>
		</Center>
	)
}

export default EmptyState
