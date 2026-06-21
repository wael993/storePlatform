import {
	ArrowForwardIcon,
	CalendarIcon,
	CheckIcon,
	ChevronDownIcon,
	CloseIcon,
	HamburgerIcon,
	LockIcon,
	SettingsIcon,
	StarIcon,
	ViewIcon,
} from '@chakra-ui/icons'
import {
	Avatar,
	Box,
	Divider,
	Flex,
	IconButton,
	Portal,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import { ReactElement, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
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
	isSettingsVisible?: boolean
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
		cursor: 'pointer',
		width: '100%',
		_hover: { bg: '#F7FAFC' },
		_active: { bg: '#F7FAFC' },
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
	menuPanel: {
		position: 'fixed',
		top: 'var(--layout-topbar-height, 4rem)',
		left: 0,
		right: 0,
		insetInlineStart: 0,
		insetInlineEnd: 0,
		width: '100%',
		maxW: '100vw',
		height: 'calc(100dvh - var(--layout-topbar-height, 4rem))',
		bg: 'white',
		overflowY: 'auto',
		zIndex: 1500,
		p: 5,
		boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
	},
	menuGroupTitle: {
		px: 0,
		mb: 4,
		fontSize: '2xl',
		fontWeight: 800,
		lineHeight: 1.2,
		color: '#1A202C',
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
	isSettingsVisible = false,
}: ServiceMenuProps) => {
	const navigate = useNavigate()
	const location = useLocation()
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const { isOpen, onToggle, onClose } = useDisclosure()
	const {
		isOpen: isPwOpen,
		onOpen: onPwOpen,
		onClose: onPwClose,
	} = useDisclosure()

	useEffect(() => {
		onClose()
	}, [location.pathname, onClose])

	useEffect(() => {
		if (!isOpen) return

		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'

		return () => {
			document.body.style.overflow = previousOverflow
		}
	}, [isOpen])

	const handleNavigate = (path: string) => {
		onClose()
		navigate(path)
	}

	const handleLogout = () => {
		onClose()
		void onLogout()
	}

	const handleChangePassword = () => {
		onClose()
		onPwOpen()
	}

	return (
		<>
			<IconButton
				aria-label={t('components.topBar.menu')}
				aria-expanded={isOpen}
				icon={
					isOpen ? <CloseIcon boxSize={4} /> : <HamburgerIcon boxSize={5} />
				}
				onClick={onToggle}
				sx={styles.iconButton}
				position="relative"
				zIndex={1501}
			/>

			{isOpen && (
				<Portal>
					<Box
						sx={styles.menuPanel}
						dir={isArabic ? 'rtl' : 'ltr'}
						role="dialog"
						aria-modal="true"
						aria-label={t('components.topBar.menu')}
					>
						<Text sx={styles.menuGroupTitle}>{t('appTitle')}</Text>

						{navItems.length === 0 ? (
							<Box sx={styles.menuItem} opacity={0.6}>
								{t('components.topBar.noNavigationItems')}
							</Box>
						) : (
							navItems.map(item => {
								const isActive = item.path === activePath

								return (
									<Box
										key={item.path}
										as="button"
										type="button"
										onClick={() => handleNavigate(item.path)}
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
									</Box>
								)
							})
						)}

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

						{isSettingsVisible ? (
							<Box
								as="button"
								type="button"
								onClick={() => handleNavigate(RoutePaths.SETTINGS)}
								sx={styles.menuItem}
							>
								<Flex align="center" justify="space-between" w="full" gap={4}>
									<Flex align="center" gap={4}>
										<SettingsIcon sx={styles.menuIcon} />
										<Text>{t('components.topBar.settings')}</Text>
									</Flex>
									<ChevronDownIcon sx={styles.menuIcon} />
								</Flex>
							</Box>
						) : null}

						<Divider my={5} />
						<Box
							as="button"
							type="button"
							onClick={handleChangePassword}
							sx={styles.menuItem}
						>
							<Flex align="center" w="full" gap={4}>
								<LockIcon sx={styles.menuIcon} />
								<Text>{t('components.topBar.changePassword')}</Text>
							</Flex>
						</Box>
						<Box
							as="button"
							type="button"
							onClick={handleLogout}
							sx={styles.menuItem}
							opacity={isLogoutLoading ? 0.6 : 1}
							pointerEvents={isLogoutLoading ? 'none' : 'auto'}
						>
							<Flex align="center" w="full" gap={4}>
								<ArrowForwardIcon
									sx={{
										...styles.menuIcon,
										transform: isArabic ? 'scaleX(-1)' : undefined,
									}}
								/>
								<Text>{t('components.topBar.logout')}</Text>
							</Flex>
						</Box>
					</Box>
				</Portal>
			)}

			<ChangePasswordModal isOpen={isPwOpen} onClose={onPwClose} />
		</>
	)
}

export default ServiceMenu
