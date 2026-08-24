import {
	Box,
	Button,
	Flex,
	HStack,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import CustomBreadcrumb from './CustomBreadcrumb'
import { generateBreadcrumbs } from '../shared/routes'
import { compareTargetType, formatNumber } from '../shared/utils'
import {
	AllowedActions,
	BreadCrumbItem,
	TargetType,
} from '../shared/globalEnums'
import { CloseButton } from './common/CloseButton'
import { AddSquareIcon } from './icons/AddSquare'
import { hoverFocusActiveButtonStyles } from '../theme/styles'
import AddDailyActionModal from './modals/DailyAction/AddDailyActionModal'
import { useResources } from '../shared/hooks/useResources'
import { useUser } from '../shared/hooks/useUser'
import { useSee } from '../shared/hooks/useSee'
import { SEE } from '../shared/seeFlags'
import PartyInvoiceSummaryCards from './common/PartyInvoiceSummaryCards'
import { PRODUCT_STATE_CONFIG } from './list/shared/constants'
import { ActivityState } from './list/shared/globalEnums'

const fullWidth = '100%'
const mutedTextColor = '#929494'
const borderColor = '#EAEAEA'

const TYPE_CHIP: Partial<
	Record<TargetType, { translationKey: TranslationKey; color: string }>
> = {
	[TargetType.CUSTOMER]: {
		translationKey: 'common.customer',
		color: '#5698E6',
	},
	[TargetType.SUPPLIER]: {
		translationKey: 'common.supplier',
		color: '#E7CB3A',
	},
	[TargetType.PARTNER]: {
		translationKey: 'common.partner',
		color: '#9B59B6',
	},
}

const BREADCRUMB_ITEM = {
	[TargetType.CUSTOMER]: BreadCrumbItem.CUSTOMER,
	[TargetType.SUPPLIER]: BreadCrumbItem.SUPPLIER,
	[TargetType.PARTNER]: BreadCrumbItem.PARTNER,
	[TargetType.PRODUCT]: BreadCrumbItem.PRODUCT,
} as const

const styles = {
	wrapper: {
		width: fullWidth,
		flexDir: 'column',
		paddingBottom: '1rem',
	},
	header: {
		flexDir: 'column',
		width: fullWidth,
	},
	titleRow: {
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		flexWrap: 'wrap',
		gap: '0.75rem',
		paddingTop: '0.5rem',
	},
	titleDrawer: {
		fontSize: '1.25rem',
		fontWeight: '700',
		color: '#1E1E1E',
		lineHeight: '1.4',
	},
	metaRow: {
		alignItems: 'center',
		flexWrap: 'wrap',
		gap: '0.375rem',
		mt: '0.25rem',
		color: mutedTextColor,
		fontSize: '0.875rem',
		fontWeight: 600,
		minH: '1.25rem',
	},
	metaDot: {
		color: '#C4C4C4',
		fontWeight: 500,
	},
	chip: {
		alignItems: 'center',
		gap: '0.375rem',
	},
	chipDot: {
		width: '0.5rem',
		height: '0.5rem',
		borderRadius: 'full',
		flexShrink: 0,
	},
	chipLabel: {
		fontSize: '0.875rem',
		fontWeight: 600,
		color: mutedTextColor,
		lineHeight: '1.2',
	},
	addButton: {
		...hoverFocusActiveButtonStyles,
		gap: '0.25rem',
	},
	addButtonText: {
		fontSize: '0.875rem',
		fontWeight: 700,
		color: '#1E1E1E',
	},
	divider: {
		borderWidth: 0,
		height: '1px',
		backgroundColor: borderColor,
		width: fullWidth,
		marginY: '1rem',
	},
	factsRow: {
		display: 'grid',
		gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
		gap: '1rem',
		width: fullWidth,
	},
	factCell: {
		flexDir: 'column',
		alignItems: 'flex-start',
		gap: '0.125rem',
		minW: 0,
	},
	factLabel: {
		color: mutedTextColor,
		fontSize: '0.75rem',
		fontWeight: 700,
		lineHeight: '1.2',
	},
	factValue: {
		color: '#1E1E1E',
		fontSize: '1rem',
		fontWeight: 700,
		lineHeight: '1.3',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		width: fullWidth,
	},
} satisfies StylesObject

interface TopSectionProps {
	targetType: TargetType
	customer?: Customer
	product?: Product
	supplier?: Supplier
	partner?: Partner
	onClose: () => void
}

const StatusChip = ({ color, label }: { color: string; label: string }) => (
	<HStack sx={styles.chip} spacing={0}>
		<Box sx={{ ...styles.chipDot, bg: color }} />
		<Text sx={styles.chipLabel}>{label}</Text>
	</HStack>
)

const TopSection = ({
	targetType,
	customer,
	product,
	supplier,
	partner,
	onClose,
}: TopSectionProps) => {
	const { isProductTarget } = compareTargetType(targetType)
	const {
		isOpen: isAddDailyActionModalOpen,
		onOpen: onAddDailyActionModalOpen,
		onClose: onAddDailyActionModalClose,
	} = useDisclosure()
	const { isActionAllowed } = useResources()
	const { isAdmin } = useUser()
	const { canSee } = useSee()
	const canAddEntries = canSee(SEE.invoicesEntriesAdd)
	const { t } = useTranslation()
	const entry = customer ?? supplier ?? partner ?? product

	if (!entry) return null

	const entryTargetId =
		customer?.customerId ??
		supplier?.supplierId ??
		partner?.partnerId ??
		product?.productId ??
		''

	const breadCrumbItems = generateBreadcrumbs({
		targetType,
		id: entryTargetId,
		name: entry.name,
	})
	const breadcrumbKey =
		BREADCRUMB_ITEM[targetType as keyof typeof BREADCRUMB_ITEM] ??
		BreadCrumbItem.SUPPLIER

	const productState = product
		? PRODUCT_STATE_CONFIG[product.status as ActivityState]
		: undefined
	const typeChip = TYPE_CHIP[targetType]
	const chip = isProductTarget
		? productState && (
				<StatusChip
					color={productState.color}
					label={t(productState.translationKey)}
				/>
			)
		: typeChip && (
				<StatusChip color={typeChip.color} label={t(typeChip.translationKey)} />
			)

	const barcode =
		isProductTarget && canSee(SEE.barcode) && product?.barcode?.trim()
			? product.barcode
			: undefined

	const metaItems = [entry.internalCode, chip, barcode].filter(Boolean)

	const productFacts: { label: string; value: string }[] = []
	if (isProductTarget && product) {
		const stockValue = formatNumber(product.inventory?.quantity)
		if (product.inventory?.quantity != null && stockValue) {
			productFacts.push({
				label: t('common.stockQuantity'),
				value: stockValue,
			})
		}
		const retailValue = [
			formatNumber(product.price?.retailPrice),
			product.price?.currency,
		]
			.filter(Boolean)
			.join(' ')
		if (product.price?.retailPrice != null && retailValue) {
			productFacts.push({
				label: t('common.sellPrice'),
				value: retailValue,
			})
		}
		const buyValue = [
			formatNumber(product.price?.purchasePrice),
			product.price?.currency,
		]
			.filter(Boolean)
			.join(' ')
		if (
			canSee(SEE.productsBuyingPrice) &&
			product.price?.purchasePrice != null &&
			buyValue
		) {
			productFacts.push({
				label: t('common.buyCost'),
				value: buyValue,
			})
		}
		if (product.categoryName?.trim()) {
			productFacts.push({
				label: t('common.category'),
				value: product.categoryName,
			})
		}
	}

	const showInvoiceFacts = Boolean(customer?.customerId || supplier?.supplierId)
	const showFacts = showInvoiceFacts || productFacts.length > 0
	const canAddDailyAction =
		isActionAllowed(AllowedActions.CAN_ADD_DAILY_ACTION) &&
		isAdmin &&
		canAddEntries

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[breadcrumbKey]}
				/>
				<Flex sx={styles.titleRow}>
					<Box minW="12rem" flex="1">
						<Text sx={styles.titleDrawer}>{entry.name}</Text>
						{metaItems.length > 0 && (
							<HStack sx={styles.metaRow} spacing={0}>
								{metaItems.map((item, index) => (
									<HStack key={index} spacing="0.375rem">
										{index > 0 && <Text sx={styles.metaDot}>·</Text>}
										{typeof item === 'string' ? <Text>{item}</Text> : item}
									</HStack>
								))}
							</HStack>
						)}
					</Box>
					<HStack spacing="0.5rem" flexShrink={0} alignItems="center">
						{canAddDailyAction && (
							<Button
								leftIcon={<AddSquareIcon />}
								onClick={onAddDailyActionModalOpen}
								sx={styles.addButton}
								variant="ghost"
							>
								<Text sx={styles.addButtonText}>{t('common.addEntry')}</Text>
							</Button>
						)}
						<CloseButton onClose={onClose} />
					</HStack>
				</Flex>

				{showFacts && (
					<>
						<Box sx={styles.divider} />
						{showInvoiceFacts && (
							<PartyInvoiceSummaryCards
								customerId={customer?.customerId}
								supplierId={supplier?.supplierId}
							/>
						)}
						{productFacts.length > 0 && (
							<Box sx={styles.factsRow}>
								{productFacts.map(fact => (
									<Flex key={fact.label} sx={styles.factCell}>
										<Text sx={styles.factLabel}>{fact.label}</Text>
										<Text sx={styles.factValue} title={fact.value}>
											{fact.value}
										</Text>
									</Flex>
								))}
							</Box>
						)}
					</>
				)}
			</Flex>
			<Box sx={styles.divider} />

			<AddDailyActionModal
				isOpen={isAddDailyActionModalOpen && canAddEntries}
				onClose={onAddDailyActionModalClose}
				targetType={targetType}
				entryTargetId={entryTargetId}
			/>
		</Flex>
	)
}

export default TopSection
