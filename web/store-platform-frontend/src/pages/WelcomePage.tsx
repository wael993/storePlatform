import {
	Box,
	Flex,
	Heading,
	Image,
	SimpleGrid,
	Stack,
	Text,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'
import { useUser } from '../shared/hooks/useUser'
import { useSee } from '../shared/hooks/useSee'
import { SEE } from '../shared/seeFlags'
import { ArrowForwardIcon } from '../shared/icons/ArrowForward'
import {
	compareLanguage,
	getEnabledActions,
	getTenantActions,
} from '../shared/utils'
import { getRouteLabel, RoutePaths } from '../shared/routes'
import { TENANT_PAGE_DESCRIPTION_KEYS } from '../shared/tenantAccessiblePages'
import { pageContentMinHeight } from '../theme/layout'

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

const cardItem = {
	border: '1px solid',
	borderColor: 'gray.100',
	borderRadius: '1.25rem',
	p: 5,
	bg: 'gray.50',
} as const

const styles = {
	wrapper: {
		minH: pageContentMinHeight,
		alignItems: 'center',
		justifyContent: 'center',
		px: { base: 0, md: 6 },
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
	infoItem: cardItem,
	quickLink: {
		...cardItem,
		h: '100%',
		textDecoration: 'none',
		color: 'inherit',
		_hover: {
			bg: 'white',
			borderColor: 'blue.200',
			boxShadow: '0 12px 28px rgba(49, 130, 206, 0.12)',
		},
	},
} satisfies StylesObject

const WelcomePage = () => {
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const { isOwnerOrAdmin, user } = useUser()
	const { canSee } = useSee()
	const enabledActions = getEnabledActions()
	const tenantActions = getTenantActions(user?.accessiblePages)

	const {
		isProductsEnabled,
		isInvoicesEnabled,
		isDailyEnabled,
		isCustomersEnabled,
		isSellingInvoicesEnabled,
		isReportsEnabled,
		isCategoriesEnabled,
		isSuppliersEnabled,
		isEmployeesEnabled,
	} = enabledActions

	const {
		isTenantProductsEnabled,
		isTenantInvoicesEnabled,
		isTenantDailyEnabled,
		isTenantCustomersEnabled,
		isTenantSellingInvoicesEnabled,
		isTenantReportsEnabled,
		isTenantCategoriesEnabled,
		isTenantSuppliersEnabled,
		isTenantEmployeesEnabled,
	} = tenantActions

	const quickLinks = [
		isDailyEnabled && isTenantDailyEnabled && canSee(SEE.daily)
			? {
					path: RoutePaths.DAILY,
					descriptionKey: TENANT_PAGE_DESCRIPTION_KEYS.DAILY,
				}
			: null,
		isProductsEnabled && isTenantProductsEnabled && canSee(SEE.products)
			? {
					path: RoutePaths.PRODUCTS,
					descriptionKey: TENANT_PAGE_DESCRIPTION_KEYS.PRODUCTS,
				}
			: null,
		isOwnerOrAdmin && isInvoicesEnabled && isTenantInvoicesEnabled
			? {
					path: RoutePaths.INVOICES,
					descriptionKey: TENANT_PAGE_DESCRIPTION_KEYS.INVOICE,
				}
			: null,
		isCustomersEnabled && isTenantCustomersEnabled && canSee(SEE.customers)
			? {
					path: RoutePaths.CUSTOMERS,
					descriptionKey: TENANT_PAGE_DESCRIPTION_KEYS.CUSTOMERS,
				}
			: null,
		isSuppliersEnabled && isTenantSuppliersEnabled && canSee(SEE.supplier)
			? {
					path: RoutePaths.SUPPLIERS,
					descriptionKey: TENANT_PAGE_DESCRIPTION_KEYS.SUPPLIERS,
				}
			: null,
		isEmployeesEnabled && isTenantEmployeesEnabled && canSee(SEE.employees)
			? {
					path: RoutePaths.EMPLOYEES,
					descriptionKey: TENANT_PAGE_DESCRIPTION_KEYS.EMPLOYEES,
				}
			: null,
		isSellingInvoicesEnabled &&
		isTenantSellingInvoicesEnabled &&
		canSee(SEE.invoices)
			? {
					path: RoutePaths.SELLING_INVOICES,
					descriptionKey: TENANT_PAGE_DESCRIPTION_KEYS.SELLING_INVOICES,
				}
			: null,
		isReportsEnabled && isTenantReportsEnabled && canSee(SEE.reports)
			? {
					path: RoutePaths.REPORTS,
					descriptionKey: TENANT_PAGE_DESCRIPTION_KEYS.REPORTS,
				}
			: null,
		isCategoriesEnabled && isTenantCategoriesEnabled && canSee(SEE.categories)
			? {
					path: RoutePaths.CATEGORIES,
					descriptionKey: TENANT_PAGE_DESCRIPTION_KEYS.CATEGORIES,
				}
			: null,
	].filter(Boolean) as { path: string; descriptionKey: string }[]

	return (
		<Flex sx={styles.wrapper}>
			<Stack sx={styles.card} gap={0}>
				<Flex sx={styles.hero}>
					<Stack align="center" maxW="42rem" gap={4}>
						<Flex sx={styles.logoWrap}>
							<Image
								src="/favicon.ico"
								alt={t('components.topBar.logoAlt')}
								w={{ base: '4.5rem', md: '8.5rem' }}
								h={{ base: '4.5rem', md: '8.5rem' }}
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
						<Text
							color="gray.600"
							fontSize={{ base: 'md', md: 'lg' }}
							maxW="34rem"
						>
							{t('welcome.subtitle')}
						</Text>
					</Stack>
				</Flex>

				<Box sx={styles.infoPanel}>
					<Stack gap={8}>
						{quickLinks.length > 0 && (
							<Stack gap={4}>
								<Text color="gray.900" fontWeight={800}>
									{t('welcome.quickLinks')}
								</Text>
								<SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
									{quickLinks.map(item => (
										<Stack
											key={item.path}
											as={RouterLink}
											to={item.path}
											sx={styles.quickLink}
											gap={2}
										>
											<Flex align="center" justify="space-between" gap={3}>
												<Text color="gray.900" fontWeight={800}>
													{getRouteLabel(item.path)}
												</Text>
												<ArrowForwardIcon
													boxSize={4}
													color="blue.500"
													flexShrink={0}
													transform={isArabic ? 'scaleX(-1)' : undefined}
												/>
											</Flex>
											<Text color="gray.600" fontSize="sm" lineHeight="1.6">
												{t(item.descriptionKey)}
											</Text>
										</Stack>
									))}
								</SimpleGrid>
							</Stack>
						)}
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
					</Stack>
				</Box>
			</Stack>
		</Flex>
	)
}

export default WelcomePage
