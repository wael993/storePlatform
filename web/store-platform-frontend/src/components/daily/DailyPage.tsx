import {
	Box,
	Button,
	Flex,
	Heading,
	HStack,
	Spinner,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	BreadCrumbItem,
	AllowedActions,
	TargetType,
} from '../../shared/globalEnums'
import { ENTRY_TYPE_LABELS_MAP } from '../../shared/globalConstant'
import { useResources } from '../../shared/hooks/useResources'
import { useUser } from '../../shared/hooks/useUser'
import { generateBreadcrumbs } from '../../shared/routes'
import { hoverFocusActiveButtonStyles } from '../../theme/styles'
import CustomBreadcrumb from '../CustomBreadcrumb'
import Filters from '../filters/Filters'
import { FilterSelectOption, ProductFilterValues } from '../filters/FilterModal'
import { AddSquareIcon } from '../icons/AddSquare'
import AddDailyActionModal from '../modals/DailyAction/AddDailyActionModal'
import DailyActionsListWithActionBar from './list/DailyActionsListWithActionBar'
import {
	useGetDailyActionFilterValuesQuery,
	useGetDailyActionsQuery,
} from '../../api/apiStore'
import { ExcelDownload } from '../ExcelDownload'

const fullWidth = '100%'

const getDateInputValueFromDate = (date: Date) => {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')

	return `${year}-${month}-${day}`
}

const getDefaultDailyFilters = (): ProductFilterValues => {
	const today = new Date()
	const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
	const endOfCurrentMonth = new Date(
		today.getFullYear(),
		today.getMonth() + 1,
		0,
	)

	return {
		searchText: '',
		supplier: [],
		brand: [],
		state: [],
		category: [],
		entryType: [],
		productName: [],
		customer: [],
		invoiceDateFrom: getDateInputValueFromDate(startOfCurrentMonth),
		invoiceDateTo: getDateInputValueFromDate(endOfCurrentMonth),
	}
}

const styles = {
	wrapper: {
		width: fullWidth,
		flexDir: 'column',
		paddingBottom: '1rem',
	},
	header: {
		flexDir: 'column',
		width: fullWidth,
		paddingX: '1rem',
	},
	title: {
		fontSize: '1.5rem',
		fontWeight: 700,
		marginTop: '0.4rem',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		display: 'block',
		whiteSpace: 'nowrap',
		paddingX: '1rem',
	},
	divider: {
		borderBottom: `1px solid #EAEAEA}`,
		marginTop: '1px',
		marginRight: {
			base: '0',
			md: '0.5rem',
			xl: '0.5rem',
		},
	},
	addProductButton: {
		...hoverFocusActiveButtonStyles,
		gap: '0.25rem',
	},
	addProductButtonText: {
		fontSize: '0.875rem',
		fontWeight: 700,
		color: '#1E1E1E',
	},
} satisfies StylesObject
interface DailyPageProps {
	targetType: TargetType
}

const DailyPage = ({ targetType }: DailyPageProps) => {
	const breadCrumbItems = generateBreadcrumbs()
	const { t } = useTranslation()
	const { isActionAllowed } = useResources()
	const { isOwnerOrAdmin } = useUser()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const [dailyFilters, setDailyFilters] = useState<ProductFilterValues>(
		getDefaultDailyFilters,
	)

	const { data: dailyActions = [], isLoading: isDailyActionsLoading } =
		useGetDailyActionsQuery(dailyFilters)
	const { data: dailyFilterValues } = useGetDailyActionFilterValuesQuery()

	const entryTypeOptions: FilterSelectOption[] = useMemo(() => {
		return (dailyFilterValues?.entryType ?? []).map(option => {
			const translationKey = ENTRY_TYPE_LABELS_MAP[option.value]
			return {
				...option,
				label: translationKey ? t(translationKey) : option.label,
			}
		})
	}, [dailyFilterValues?.entryType, t])

	const handleApplyFilters = (filters: ProductFilterValues) => {
		setDailyFilters(filters)
	}

	const handleResetFilters = () => {
		setDailyFilters(getDefaultDailyFilters())
	}

	return (
		<Flex sx={styles.wrapper}>
			<Flex sx={styles.header}>
				<CustomBreadcrumb
					marginTop="2rem"
					items={breadCrumbItems[BreadCrumbItem.DAILY]}
				/>
			</Flex>

			<HStack justify="space-between" mb={'4rem'}>
				<Heading sx={styles.title} variant={'h5'}>
					{t('components.pageHeaders.daily')}
				</Heading>
				{isActionAllowed(AllowedActions.CAN_ADD_DAILY_ACTION) &&
					isOwnerOrAdmin && (
						<HStack>
							<Button
								leftIcon={<AddSquareIcon />}
								onClick={onOpen}
								sx={styles.addProductButton}
								variant="ghost"
							>
								<Text sx={styles.addProductButtonText}>
									{t('common.addDailyAction')}
								</Text>
							</Button>
							<ExcelDownload
								targetType={TargetType.DAILY_ACTION}
								queryParams={dailyFilters}
							/>
						</HStack>
					)}
			</HStack>

			{isDailyActionsLoading && <Spinner />}
			<Box sx={styles.divider} />

			<Filters
				filters={dailyFilters}
				onApplyFilters={handleApplyFilters}
				onResetFilters={handleResetFilters}
				supplierOptions={dailyFilterValues?.supplier ?? []}
				brandOptions={[]}
				stateOptions={[]}
				categoryOptions={[]}
				entryTypeOptions={entryTypeOptions}
				productNameOptions={dailyFilterValues?.productName ?? []}
				customerOptions={dailyFilterValues?.customer ?? []}
				showSupplierFilter={true}
				fieldVisibility={{
					entryType: true,
					productName: true,
					supplier: true,
					customer: true,
					invoiceDate: true,
					brand: false,
					state: false,
					category: false,
				}}
			/>

			<DailyActionsListWithActionBar
				dailyActions={dailyActions}
				isLoading={isDailyActionsLoading}
			/>

			<AddDailyActionModal
				isOpen={isOpen}
				onClose={onClose}
				targetType={targetType}
			/>
		</Flex>
	)
}

export default DailyPage
