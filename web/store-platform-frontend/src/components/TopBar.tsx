import { HamburgerIcon, RepeatIcon, SettingsIcon } from '@chakra-ui/icons'
import {
	Box,
	Flex,
	FormControl,
	Image,
	IconButton,
	Select,
	Text,
} from '@chakra-ui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AsBellIcon } from '../icons/Bell'
import { hoverFocusActiveButtonStyles } from '../theme/styles'

interface TopBarProps {
	navItems: {
		label: string
		path: string
	}[]
}

const styles = {
	iconButton: {
		boxSize: 6,
		bg: 'transparent',
		fontSize: 'xl',
		color: '#353535',
		...hoverFocusActiveButtonStyles,
	},
} satisfies StylesObject

const TopBar = ({ navItems }: TopBarProps) => {
	const location = useLocation()
	const navigate = useNavigate()

	const activePath =
		navItems.find(
			item =>
				location.pathname === item.path ||
				location.pathname.startsWith(`${item.path}/`),
		)?.path ?? ''

	return (
		<Box
			position="sticky"
			top={0}
			zIndex={20}
			bg="white"
			boxShadow="0 8px 20px rgba(15, 23, 42, 0.12)"
			mb={6}
			px={'7rem'}
		>
			<Flex
				h="7rem"
				px={0}
				py={0}
				align="center"
				justify="space-between"
				gap={4}
			>
				<Flex align="center" gap={4} minW={0}>
					<Image
						src="/favicon.ico"
						alt="Store Platform Logo"
						w="46px"
						h="46px"
						objectFit="contain"
					/>
					<Text
						fontSize="xl"
						fontWeight="semibold"
						color="gray.800"
						whiteSpace="nowrap"
					>
						Store Platform
					</Text>

					<FormControl maxW={{ base: '9rem', md: '10rem' }}>
						<Select
							size="lg"
							value={activePath}
							onChange={event => navigate(event.target.value)}
							bg="white"
							borderColor="transparent"
							color={'#939495'}
							fontWeight={700}
							width={'10rem'}
						>
							{navItems.map(item => (
								<option key={item.path} value={item.path}>
									{item.label}
								</option>
							))}
						</Select>
					</FormControl>
				</Flex>

				<Flex align="center" gap={2}>
					<IconButton
						aria-label="Notifications"
						icon={<AsBellIcon />}
						sx={styles.iconButton}
						onClick={e => {
							e.stopPropagation()
						}}
					/>

					<IconButton
						aria-label="Release Notes"
						icon={<RepeatIcon boxSize={4} />}
						sx={styles.iconButton}
						onClick={e => {
							e.stopPropagation()
						}}
					/>

					<IconButton
						aria-label="Settings"
						icon={<SettingsIcon boxSize={4} />}
						sx={styles.iconButton}
						onClick={e => {
							e.stopPropagation()
						}}
					/>
					<IconButton
						aria-label="Menu"
						icon={<HamburgerIcon boxSize={5} />}
						sx={styles.iconButton}
						onClick={e => {
							e.stopPropagation()
						}}
					/>
				</Flex>
			</Flex>
			{navItems.length === 0 && (
				<Text p={0} fontSize="sm" color="gray.500">
					No navigation items available.
				</Text>
			)}
		</Box>
	)
}

export default TopBar
