import {
	ArrowForwardIcon,
	AtSignIcon,
	CalendarIcon,
	CheckIcon,
	ChevronDownIcon,
	CloseIcon,
	HamburgerIcon,
	LockIcon,
	QuestionIcon,
	SettingsIcon,
	StarIcon,
	ViewIcon,
} from '@chakra-ui/icons'
import {
	Avatar,
	Divider,
	Flex,
	IconButton,
	Menu,
	MenuButton,
	MenuGroup,
	MenuItem,
	MenuList,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getRouteLabel, RoutePaths } from '../shared/routes'
import { compareLanguage } from '../shared/utils'
import { hoverFocusActiveButtonStyles } from '../theme/styles'
import ChangePasswordModal from './ChangePasswordModal'

interface ServiceMenuProps {
	navItems: {
		label: string
		path: string
	}[]
	activePath: string
	userName: string
	onLogout: () => void | Promise<void>
	isLogoutLoading?: boolean
}

const styles = {
	iconButton: {
		boxSize: 6,
		bg: 'transparent',
		fontSize: 'xl',
		color: '#353535',
		...hoverFocusActiveButtonStyles,
	},
	menuItem: {
		px: 5,
		py: 4,
		borderRadius: 'xl',
		fontSize: 'lg',
		fontWeight: 700,
		color: '#353535',
		bg: 'white',
		_hover: { bg: '#F7FAFC' },
		_focus: { bg: '#F7FAFC' },
	},
	activeMenuItem: {
		bg: '#EBF8FF',
		color: '#1A365D',
	},
	menuIcon: {
		boxSize: 6,
		color: '#6F7173',
		flexShrink: 0,
	},
	activeMenuIcon: {
		color: '#1A365D',
	},
} satisfies StylesObject

const getNavigationIcon = (path: string, isActive: boolean): ReactElement => {
	const iconProps = {
		sx: {
			...styles.menuIcon,
			...(isActive ? styles.activeMenuIcon : {}),
		},
	}

	switch (path) {
		case RoutePaths.DAILY:
			return <CalendarIcon {...iconProps} />
		case RoutePaths.PRODUCTS:
			return <ViewIcon {...iconProps} />
		case RoutePaths.SETTINGS:
			return <SettingsIcon {...iconProps} />
		default:
			return <StarIcon {...iconProps} />
	}
}

const ServiceMenu = ({
	navItems,
	activePath,
	userName,
	onLogout,
	isLogoutLoading = false,
}: ServiceMenuProps) => {
	const navigate = useNavigate()
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const {
		isOpen: isPwOpen,
		onOpen: onPwOpen,
		onClose: onPwClose,
	} = useDisclosure()
	return (
		<>
			<Menu placement="bottom-end" closeOnSelect>
				{({ isOpen, onClose }) => (
					<>
						<MenuButton
							as={IconButton}
							aria-label={t('components.topBar.menu')}
							icon={
								isOpen ? (
									<CloseIcon boxSize={4} />
								) : (
									<HamburgerIcon boxSize={5} />
								)
							}
							sx={styles.iconButton}
							position="relative"
							zIndex={1500}
						/>
						<MenuList
							w="100vw"
							h="100dvh"
							mt={'4rem'}
							p={5}
							border={0}
							borderRadius={0}
							boxShadow="none"
							overflowY="auto"
							zIndex={1500}
							dir={isArabic ? 'rtl' : 'ltr'}
							sx={{
								transform: 'none !important',
								'.chakra-menu__group__title': {
									px: 0,
									mb: 4,
									fontSize: '2xl',
									fontWeight: 800,
									lineHeight: 1.2,
									color: '#1A202C',
								},
							}}
						>
							<MenuGroup title={t('appTitle')}>
								{navItems.length === 0 ? (
									<MenuItem sx={styles.menuItem} isDisabled>
										{t('components.topBar.noNavigationItems')}
									</MenuItem>
								) : (
									navItems.map(item => {
										const isActive = item.path === activePath

										return (
											<MenuItem
												key={item.path}
												onClick={() => navigate(item.path)}
												sx={{
													...styles.menuItem,
													...(isActive ? styles.activeMenuItem : {}),
												}}
												aria-current={isActive ? 'page' : undefined}
											>
												<Flex
													align="center"
													justify="space-between"
													w="full"
													gap={4}
												>
													<Flex align="center" gap={4} minW={0}>
														{getNavigationIcon(item.path, isActive)}
														<Text noOfLines={1}>
															{getRouteLabel(item.path, item.label)}
														</Text>
													</Flex>
													{isActive && (
														<CheckIcon boxSize={4} sx={styles.activeMenuIcon} />
													)}
												</Flex>
											</MenuItem>
										)
									})
								)}
							</MenuGroup>

							<Divider my={5} />

							<Flex align="center" justify="space-between" mb={8}>
								<Flex align="center" gap={3} minW={0}>
									<Avatar
										name={userName}
										size="sm"
										bg="#E071D4"
										color="black"
										fontWeight={800}
									/>
									<Text
										fontSize="sm"
										fontWeight={500}
										color="#6F7173"
										noOfLines={1}
									>
										{t('components.topBar.greeting', { userName })}
									</Text>
								</Flex>
							</Flex>

							<MenuItem
								sx={styles.menuItem}
								onClick={() => navigate(RoutePaths.SETTINGS)}
							>
								<Flex align="center" justify="space-between" w="full" gap={4}>
									<Flex align="center" gap={4}>
										<SettingsIcon sx={styles.menuIcon} />
										<Text>{t('components.topBar.settings')}</Text>
									</Flex>
									<ChevronDownIcon sx={styles.menuIcon} />
								</Flex>
							</MenuItem>
							{/* <MenuItem sx={styles.menuItem} isDisabled>
							<Flex align="center" w="full" gap={4}>
								<AtSignIcon sx={styles.menuIcon} />
								<Text>Account</Text>
							</Flex>
						</MenuItem>
						<MenuItem sx={styles.menuItem} isDisabled>
							<Flex align="center" w="full" gap={4}>
								<QuestionIcon sx={styles.menuIcon} />
								<Text>Support</Text>
							</Flex>
						</MenuItem> */}

							<Divider my={5} />

							<MenuItem
								sx={styles.menuItem}
								onClick={onLogout}
								isDisabled={isLogoutLoading}
							>
								<Flex align="center" w="full" gap={4}>
									<ArrowForwardIcon sx={styles.menuIcon} />
									<Text>{t('components.topBar.logout')}</Text>
								</Flex>
							</MenuItem>
							<MenuItem sx={styles.menuItem} onClick={onPwOpen}>
								<Flex align="center" w="full" gap={4}>
									<LockIcon sx={styles.menuIcon} />
									<Text>{t('components.topBar.changePassword')}</Text>
								</Flex>
							</MenuItem>
						</MenuList>
					</>
				)}
			</Menu>
			<ChangePasswordModal isOpen={isPwOpen} onClose={onPwClose} />
		</>
	)
}

export default ServiceMenu
