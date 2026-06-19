import {
	Box,
	Button,
	Flex,
	GridItem,
	HStack,
	Icon,
	Spacer,
	Text,
	useDisclosure,
	VStack,
} from '@chakra-ui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import CustomBreadcrumb from './CustomBreadcrumb'
import { generateBreadcrumbs } from '../shared/routes'
import { compareTargetType } from '../shared/utils'
import {
	AllowedActions,
	BreadCrumbItem,
	TargetType,
} from '../shared/globalEnums'
import { CustomTooltip } from './common/CustomTooltip'
import { AsStarIcon } from './icons/Star'
import { AsTruckIcon } from './icons/Truck'
import EditableField from './modals/EditableField'
import { AsTargetIcon } from './icons/Target'
import { cellFieldStyles } from '../shared/styles'
import { AsClockIcon } from './icons/Clock'
import { formatDateFromAndDateTo } from '../shared/dateUtils'
import { TicketStatus } from './common/TicketStatus'
import { BudgetOverview } from './common/BudgetOverview'
import { useGetBudgetOverviewQuery } from '../api/apiStore'
import { CloseButton } from './common/CloseButton'
import { AddSquareIcon } from './icons/AddSquare'
import { hoverFocusActiveButtonStyles } from '../theme/styles'
import AddDailyActionModal from './modals/DailyAction/AddDailyActionModal'
import { useResources } from '../shared/hooks/useResources'
import { useUser } from '../shared/hooks/useUser'

const iconSize = '1.5rem'
const fullWidth = '100%'
const borderColor = '#EAEAEA'
const mutedTextColor = '#929494'
const borderRightMd = { md: `1px solid ${borderColor}` }
const widthGridItem = { lg: fullWidth, xl: '24%' }

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
	titleWrapper: {
		alignItems: 'center',
		paddingTop: '0.5rem',
		paddingBottom: '0.75rem',
		gap: '0.25rem',
	},
	titleDrawer: {
		fontSize: '1.25rem',
		fontWeight: '700',
		color: '#1E1E1E',
	},
	subHeaderText: {
		color: mutedTextColor,
		fontWeight: 700,
		marginBottom: '1rem',
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
		marginTop: '0.5rem',
		width: fullWidth,
		marginY: '1rem',
	},
	contentWrapper: {
		width: fullWidth,
		flexDirection: 'row',
		columnGap: '1rem',
		display: { base: 'grid', lg: 'grid', xl: 'flex' },
		gridTemplateColumns: {
			sm: 'repeat(1, 1fr)',
			md: 'repeat(2, 1fr)',
		},
	},
	gridItemFirst: {
		paddingY: { base: '1rem', md: '1.75rem' },
		borderRight: borderRightMd,
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'center',
		width: { lg: fullWidth, xl: '24%' },
	},
	itemWrapperWithTwoChildren: {
		alignItems: 'center',
		paddingBottom: { base: '0.5rem', md: '0.5rem', xl: '1.25rem' },
		height: { sm: 'unset', md: '2rem' },
		color: '#707070',
	},
	itemWrapperWithMargin: {
		alignItems: 'center',
		paddingBottom: { base: '0.5rem', md: '0.5rem', xl: '1.25rem' },
		height: { sm: 'unset', md: '2rem' },
		color: '#707070',
		marginLeft: '0.15rem',
	},
	icon: {
		fontSize: iconSize,
		color: mutedTextColor,
	},
	brandsList: {
		alignItems: 'start',
		gap: '0.55rem',
		width: '90%',
	},
	itemText: {
		color: mutedTextColor,
		pl: '0.5rem',
		fontSize: '1rem',
		fontWeight: '500',
		lineHeight: '1.2rem',
		whiteSpace: 'nowrap',
	},
	itemWrapperLastChild: {
		alignItems: 'center',
	},
	itemTextHidden: {
		color: mutedTextColor,
		pl: '0.5rem',
		fontSize: '1rem',
		fontWeight: '500',
		lineHeight: '1.2rem',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		width: fullWidth,
	},
	gridItemLast: {
		paddingY: { base: '1rem', md: '1.75rem' },
		borderRight: { lg: 'none', xl: `1px solid ${borderColor}` },
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'center',
		gap: { base: '0.5rem', xl: 0 },
		paddingRight: { base: '0rem', md: '1rem' },
		width: { lg: fullWidth, xl: '24%' },
	},
	feeSectionGridItem: {
		borderRight: borderRightMd,
		display: 'flex',
		flexDirection: { base: 'column', lg: 'row' },
		paddingTop: { base: '1rem', md: '1.75rem' },
		paddingBottom: { base: '1rem', xl: 0 },
		justifyContent: 'center',
		gap: { base: '0.25rem', lg: '1rem' },
		paddingRight: { base: '0rem', md: '1rem' },
		width: {
			lg: fullWidth,
			xl: '24%',
		},
	},
	feeSectionGridItemLast: {
		borderRight: 'none',
		display: 'flex',
		flexDirection: { base: 'column', lg: 'row' },
		paddingTop: { base: '1rem', md: '1.75rem' },
		paddingBottom: { base: '1rem', xl: 0 },
		justifyContent: 'center',
		gap: { base: '0.25rem', lg: '1rem' },
		paddingRight: { base: '0rem', md: '1rem' },
		width: {
			lg: fullWidth,
			xl: '24%',
		},
	},
	feeSectionFlexWrapper: {
		flexDirection: 'column',
		width: { base: fullWidth, xl: '50%' },
		gap: '0.25rem',
	},
	editableFieldMainRow: {
		...cellFieldStyles.mainRow,
		width: fullWidth,
		maxWidth: fullWidth,
		justifyContent: 'space-between',
	},
	itemWrapperLastChildWithWidth: {
		alignItems: 'center',
		width: widthGridItem,
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

const TopSection = ({
	targetType,
	customer,
	product,
	supplier,
	partner,
	onClose,
}: TopSectionProps) => {
	const { isCustomerTarget, isPartnerTarget, isProductTarget } =
		compareTargetType(targetType)
	const {
		isOpen: isAddDailyActionModalOpen,
		onOpen: onAddDailyActionModalOpen,
		onClose: onAddDailyActionModalClose,
	} = useDisclosure()
	const { isActionAllowed } = useResources()
	const { isAdmin } = useUser()
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

	const budgetOverviewArgs = customer?.customerId
		? ({
				entityType: 'customer',
				id: customer.customerId,
			} satisfies BudgetOverviewQueryArgument)
		: supplier?.supplierId
			? ({
					entityType: 'supplier',
					id: supplier.supplierId,
				} satisfies BudgetOverviewQueryArgument)
			: partner?.partnerId
				? ({
						entityType: 'partner' as const,
						id: partner.partnerId,
					} satisfies BudgetOverviewQueryArgument)
				: product?.productId
					? ({
							entityType: 'product',
							id: product.productId,
						} satisfies BudgetOverviewQueryArgument)
					: undefined

	const { data: budgetOverview, isFetching: isBudgetOverviewFetching } =
		useGetBudgetOverviewQuery(
			budgetOverviewArgs ?? ({} as BudgetOverviewQueryArgument),
			{
				skip: !budgetOverviewArgs,
			},
		)

	const editableFieldProps = {
		ariaLabelName: t('common.supplierFocus'),
		placeholder: t('common.addFocus'),
		tooltip: t('common.supplierFocus'),
		textWidth: fullWidth,
		iconLeft: AsTargetIcon,
		value: entry.internalCode ?? '',
		onFieldEdition: () => Promise.resolve(),
		isLoading: false,
		isNumberField: false,
		isEditable: true,
		customStyles: {
			mainRow: styles.editableFieldMainRow,
		},
		checkIconMarginRight: '0.5rem',
		fontColor: mutedTextColor,
		iconsGap: '0.5rem',
	}

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={
						isCustomerTarget
							? breadCrumbItems[BreadCrumbItem.CUSTOMER]
							: isPartnerTarget
								? breadCrumbItems[BreadCrumbItem.PARTNER]
								: isProductTarget
									? breadCrumbItems[BreadCrumbItem.PRODUCT]
									: breadCrumbItems[BreadCrumbItem.SUPPLIER]
					}
				/>
				{isActionAllowed(AllowedActions.CAN_ADD_DAILY_ACTION) && isAdmin && (
					<HStack alignSelf={'flex-end'}>
						<Button
							leftIcon={<AddSquareIcon />}
							onClick={onAddDailyActionModalOpen}
							sx={styles.addButton}
							variant="ghost"
						>
							<Text sx={styles.addButtonText}>{t('common.addEntry')}</Text>
						</Button>
					</HStack>
				)}
				<Flex sx={{ ...styles.titleWrapper, justifyContent: 'space-between' }}>
					<Text sx={styles.titleDrawer}>{entry.name}</Text>
					<CloseButton onClose={onClose} />
				</Flex>
				<Text sx={styles.subHeaderText}>{entry.internalCode ?? ''}</Text>

				<Spacer />

				<Box sx={styles.divider} />

				<Box id="ContentWrapper" sx={styles.contentWrapper}>
					<GridItem sx={styles.gridItemFirst}>
						<Flex sx={styles.itemWrapperWithTwoChildren}>
							<Icon sx={styles.icon} as={AsStarIcon} />
							<VStack sx={styles.brandsList}>
								<Text sx={styles.itemText}>{entry.name}</Text>
							</VStack>
						</Flex>
						<Flex sx={styles.itemWrapperLastChild}>
							<Icon sx={styles.icon} as={AsTruckIcon} />
							<CustomTooltip
								styles={styles.itemTextHidden}
								label={entry.internalCode ?? ''}
								placement="bottom-start"
							>
								{entry.internalCode ?? ''}
							</CustomTooltip>
						</Flex>
					</GridItem>

					<GridItem sx={styles.gridItemLast}>
						<Flex sx={styles.itemWrapperWithTwoChildren}>
							<EditableField {...editableFieldProps} />
						</Flex>
						<Flex sx={styles.itemWrapperLastChildWithWidth}>
							<Icon sx={styles.icon} as={AsClockIcon} />
							<Text
								variant="baseStyle"
								sx={{ ...styles.itemText, textAlign: 'left' }}
							>
								{formatDateFromAndDateTo(entry?.createdAt, entry?.updatedAt)}
							</Text>
						</Flex>
					</GridItem>

					<GridItem sx={{ ...styles.feeSectionGridItem, width: widthGridItem }}>
						<Flex sx={styles.feeSectionFlexWrapper}>
							<Flex sx={styles.itemWrapperWithMargin}>
								<EditableField {...editableFieldProps} />
							</Flex>
						</Flex>
					</GridItem>

					<GridItem sx={{ ...styles.feeSectionGridItem, width: widthGridItem }}>
						<Flex
							sx={{
								...styles.feeSectionFlexWrapper,
								justifyContent: 'center',
								width: '100%',
							}}
						>
							<Flex sx={styles.itemWrapperWithMargin}>
								<BudgetOverview
									payments={budgetOverview?.payments}
									purchase={budgetOverview?.purchase}
									currency={budgetOverview?.currency}
									balance={budgetOverview?.balance}
									isFetching={isBudgetOverviewFetching}
								/>
							</Flex>
						</Flex>
					</GridItem>

					<GridItem
						sx={{
							...styles.feeSectionGridItemLast,
							width: widthGridItem,
						}}
					>
						<TicketStatus
							targetType={targetType}
							showReasonName={true}
							reasonName={entry.internalCode ?? ''}
							isMobileView={false}
						/>
					</GridItem>
				</Box>
			</Flex>
			<Box sx={styles.divider} />

			<AddDailyActionModal
				isOpen={isAddDailyActionModalOpen}
				onClose={onAddDailyActionModalClose}
				targetType={targetType}
				entryTargetId={entryTargetId}
			/>
		</Flex>
	)
}

export default TopSection
