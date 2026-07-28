import {
	ArrowForwardIcon,
	HamburgerIcon,
	RepeatIcon,
	SettingsIcon,
} from '@chakra-ui/icons'
import {
	Avatar,
	Box,
	Divider,
	Flex,
	FormControl,
	Image,
	IconButton,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	Select,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getRouteLabel, RoutePaths } from '../shared/routes'
import { compareLanguage, compareBreakpoint } from '../shared/utils'
import { AsBellIcon } from '../icons/Bell'
import { hoverFocusActiveButtonStyles } from '../theme/styles'
import { layout } from '../theme/layout'
import { useBreakpoints } from '../shared/hooks/useBreakpoints'
import ServiceMenu from './ServiceMenu'
import ChangePasswordModal from './ChangePasswordModal'
import IconsViewer from './IconsViewer'
import { GridIcon } from '../shared/icons/Grid'
import AddQuickNewEntryModal from './AddQuickNewEntryModal.tsx'
import { config } from '../config'
import { useOfflineSync } from '../shared/hooks/useOfflineSync'
import { useUser } from '../shared/hooks/useUser'
import { AsDragGripIcon } from '../shared/icons/DragGrip'

interface TopBarProps {
	navItems: {
		label: string
		path: string
	}[]
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
		px: 6,
		py: 4,
		gap: 4,
		fontSize: 'xl',
		fontWeight: 700,
		color: '#6F7173',
		bg: 'white',
		_hover: { bg: 'gray.50' },
		_focus: { bg: 'gray.50' },
	},
} satisfies StylesObject

const TopBar = ({
	navItems,
	userName,
	onLogout,
	isLogoutLoading = false,
	isSettingsVisible = false,
}: TopBarProps) => {
	const location = useLocation()
	const navigate = useNavigate()
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const {
		isOpen: isPwOpen,
		onOpen: onPwOpen,
		onClose: onPwClose,
	} = useDisclosure()
	const {
		isOpen: isIconsViewerOpen,
		onOpen: onOpenIconsViewer,
		onClose: onCloseIconsViewer,
	} = useDisclosure()
	const {
		isOpen: isAddQuickModalOpen,
		onOpen: onOpenAddQuickModal,
		onClose: onCloseAddQuickModal,
	} = useDisclosure()
	const { user } = useUser()
	const { offlineEnabled, isOnline, syncState, sync } = useOfflineSync(
		user?.tenantId,
	)

	const isSyncing = syncState === 'syncing' || syncState === 'bootstrapping'

	const handleSync = async () => {
		try {
			await sync()
		} catch {
			// Error state handled by sync service
		}
	}

	const activePath =
		navItems.find(
			item =>
				location.pathname === item.path ||
				location.pathname.startsWith(`${item.path}/`),
		)?.path ?? RoutePaths.ROOT

	return (
		<Box
			position="sticky"
			top={0}
			zIndex={20}
			bg="white"
			boxShadow="0 8px 20px rgba(15, 23, 42, 0.12)"
			px={layout.contentPaddingX}
		>
			<Flex
				h={layout.topBarHeight}
				px={0}
				py={0}
				align="center"
				justify="space-between"
				gap={{ base: 2, md: 4 }}
			>
				<Flex align="center" gap={4} minW={0}>
					<Flex
						align="center"
						gap={4}
						minW={0}
						onClick={() => navigate(RoutePaths.ROOT)}
						cursor="pointer"
					>
						<Image
							src="/favicon.ico"
							alt={t('components.topBar.logoAlt')}
							w={layout.logoSize}
							h={layout.logoSize}
							objectFit="contain"
							flexShrink={0}
						/>
						<Text
							fontSize={{ base: 'md', md: 'xl' }}
							fontWeight="semibold"
							color="gray.800"
							noOfLines={1}
							display={{ base: 'none', sm: 'block' }}
						>
							{t('appTitle')}
						</Text>
					</Flex>
					{!isMobile && (
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
								sx={{
									direction: isArabic ? 'rtl' : 'ltr',
									textAlign: isArabic ? 'right' : 'left',
									paddingLeft: isArabic ? '2rem' : undefined,
									paddingRight: isArabic ? undefined : '2rem',
									'& + .chakra-select__icon-wrapper': {
										left: isArabic ? '0.75rem' : 'auto',
										right: isArabic ? 'auto' : '0.75rem',
									},
								}}
							>
								{navItems.map(item => (
									<option key={item.path} value={item.path}>
										{getRouteLabel(
											item.path,
											item.label || t('components.topBar.welcome'),
										)}
									</option>
								))}
							</Select>
						</FormControl>
					)}
				</Flex>

				<Flex align="center" gap={2}>
					<IconButton
						aria-label={t('components.topBar.notifications')}
						icon={<AsBellIcon />}
						sx={styles.iconButton}
						onClick={e => {
							e.stopPropagation()
						}}
					/>

					{!isMobile && (
						<>
							<IconButton
								aria-label={t('components.topBar.icons')}
								icon={<GridIcon boxSize={4} />}
								sx={styles.iconButton}
								onClick={e => {
									onOpenAddQuickModal()
									e.stopPropagation()
								}}
							/>

							{offlineEnabled ? (
								<IconButton
									aria-label={t('components.topBar.sync')}
									icon={<RepeatIcon boxSize={4} />}
									sx={styles.iconButton}
									onClick={e => {
										void handleSync()
										e.stopPropagation()
									}}
									isLoading={isSyncing}
									isDisabled={!isOnline}
								/>
							) : null}
							{config.environment === 'local' ? (
								<IconButton
									aria-label={t('components.topBar.releaseNotes')}
									icon={<AsDragGripIcon boxSize={4} />}
									sx={styles.iconButton}
									onClick={e => {
										onOpenIconsViewer()
										e.stopPropagation()
									}}
								/>
							) : null}
							{isSettingsVisible ? (
								<IconButton
									aria-label={t('components.topBar.settings')}
									icon={<SettingsIcon boxSize={4} />}
									sx={styles.iconButton}
									onClick={() => navigate(RoutePaths.SETTINGS)}
								/>
							) : null}
						</>
					)}

					{isMobile && (
						<ServiceMenu
							navItems={navItems}
							activePath={activePath}
							userName={userName}
							onLogout={onLogout}
							isLogoutLoading={isLogoutLoading}
							isSettingsVisible={isSettingsVisible}
						/>
					)}
					{!isMobile && (
						<Menu placement="bottom-end">
							<MenuButton
								as={IconButton}
								aria-label={t('components.topBar.menu')}
								icon={<HamburgerIcon boxSize={5} />}
								sx={styles.iconButton}
							/>
							<MenuList
								w={{ base: 'calc(100% - 1rem)', md: '25rem' }}
								p={0}
								borderRadius={0}
								borderColor="gray.200"
								boxShadow="0 12px 28px rgba(15, 23, 42, 0.12)"
								overflow="hidden"
							>
								<Flex align="center" justify="space-between" px={8} py={8}>
									<Text fontSize="1rem" fontWeight={500} color="black">
										{t('components.topBar.greeting', { userName })}
									</Text>
									<Avatar
										name={userName}
										size="md"
										bg="#E071D4"
										color="black"
										fontWeight={800}
									/>
								</Flex>

								<Divider my={2} />

								<MenuItem sx={styles.menuItem} onClick={onPwOpen}>
									<Text>{t('components.topBar.changePassword')}</Text>
								</MenuItem>
								<MenuItem
									sx={styles.menuItem}
									onClick={onLogout}
									isDisabled={isLogoutLoading}
								>
									<ArrowForwardIcon boxSize={7} color="#6F7173" />
									<Text>{t('components.topBar.logout')}</Text>
								</MenuItem>
							</MenuList>
						</Menu>
					)}
				</Flex>
			</Flex>
			{navItems.length === 0 && (
				<Text p={0} fontSize="sm" color="gray.500">
					{t('components.topBar.noNavigationItems')}
				</Text>
			)}

			<ChangePasswordModal isOpen={isPwOpen} onClose={onPwClose} />
			<IconsViewer isOpen={isIconsViewerOpen} onClose={onCloseIconsViewer} />
			<AddQuickNewEntryModal
				isOpen={isAddQuickModalOpen}
				onClose={onCloseAddQuickModal}
			/>
		</Box>
	)
}

export default TopBar
