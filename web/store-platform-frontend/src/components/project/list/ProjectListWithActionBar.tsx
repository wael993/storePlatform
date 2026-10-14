import {
	Accordion,
	AccordionButton,
	AccordionIcon,
	AccordionItem,
	AccordionPanel,
	Box,
	Checkbox,
	Flex,
	Grid,
	GridItem,
	Icon,
	IconButton,
	Input,
	InputGroup,
	InputLeftElement,
	Skeleton,
	Table,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tooltip,
	Tr,
	useDisclosure,
	VStack,
} from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import EmptyState from '../../common/EmptyState'
import { compareBreakpoint, withNoValueFallback } from '../../../shared/utils'
import { useBreakpoints } from '../../../shared/hooks/useBreakpoints'
import {
	compareNumbersForSorting,
	compareStringsForSorting,
	matchesNameOrCode,
} from '../../list/shared/utils'
import { AsSearchIcon } from '../../../icons/Search'
import { AsTrashIcon } from '../../../icons/Trash'
import { hoverFocusActiveButtonStyles } from '../../../theme/styles'
import ConfirmationDialog from '../../ConfirmationDialog'
import {
	useDeleteProjectMutation,
	useBulkDeleteProjectsMutation,
} from '../../../api/apiStore'
import useCustomToast from '../../common/CustomToast'
import { listStyles } from '../../../shared/styles'
import OptionsPopover from '../../modals/OptionsPopover'
import NotificationCircle from '../../NotificationCircle'
import StateCircle from '../../StateCircle'
import { PAGE_COLORS } from '../../SellingInvoice/constants'
import { useInvoiceDisplayCurrency } from '../../SellingInvoice/useInvoiceDisplayCurrency'
import TableSort from '../../common/CustomTableSort'
import { CUSTOMER_LIST_WIDTHS_MAP_IN_REM } from '../../list/shared/constants'
import { SortOrder } from '../../list/shared/globalEnums'
import { useSee } from '../../../shared/hooks/useSee'
import { SEE } from '../../../shared/seeFlags'
import { buildRoutePath } from '../../../shared/routes'
import {
	deleteErrorDescription,
	useMasterBulkDelete,
	useMasterDelete,
} from '../../../shared/deleteBlock'

type ProjectSortKey = 'name' | 'code' | 'total'

const projectName = (project: Project) => project.name?.trim() || ''

const projectCode = (project: Project) => project.internalCode?.trim() || ''

const actionBarStyles = {
	mainFlexWrapper: {
		minHeight: '3.375rem',
		padding: '0.625rem 1.25rem',
		justifyContent: 'space-between',
		alignItems: 'center',
		width: '100%',
		background: '#F4F4F4',
		marginTop: '0.5rem',
		flexWrap: 'wrap',
		gap: '0.5rem',
	},
	text: {
		color: '#929494',
		fontSize: '0.75rem',
		fontWeight: 700,
		lineHeight: '1rem',
		fontStyle: 'normal',
	},
	iconButton: {
		background: '#EAEAEA',
		...hoverFocusActiveButtonStyles,
	},
} satisfies StylesObject

const headerStyles = {
	checkboxHeader: {
		left: '0',
		position: 'sticky',
		zIndex: 1,
		background: '#FFFFFF',
		padding: '4',
	},
	tableHeader: {
		paddingY: '1rem',
		paddingX: '0.375rem',
	},
	tableHeaderText: {
		fontStyle: 'normal',
		textTransform: 'none',
		color: '#939596',
		fontSize: '0.625rem',
		fontWeight: 500,
		lineHeight: '1.2rem',
		letterSpacing: 'normal',
		whiteSpace: 'nowrap',
	},
	tableHeaderStickyRight: {
		position: 'sticky',
		right: 0,
		zIndex: 4,
		height: '3rem',
		margin: 0,
		padding: 0,
	},
} satisfies StylesObject

const rowStyles = {
	tableRow: {
		padding: 0,
		height: 0,
	},
	checkboxRow: {
		left: '0',
		position: 'sticky',
		zIndex: 1,
		backgroundColor: '#FFFFFF',
	},
	cellContentWrapper: {
		...listStyles.tableCell,
		height: '100%',
		width: '100%',
		alignItems: 'center',
		justifyContent: 'start',
	},
	rightStickyContainerContent: {
		gap: '1rem',
		alignItems: 'center',
		justifyContent: 'flex-end',
		width: '14rem',
	},
	text: {
		...listStyles.tableCellText,
	},
	rightStickyContainer: {
		width: `${CUSTOMER_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem`,
		position: 'sticky',
		right: '0',
		zIndex: '1',
		background: `linear-gradient(to right, transparent 0rem, transparent 0rem, #FFFFFF 7rem, #FFFFFF 2rem, #FFFFFF ${CUSTOMER_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT}rem)`,
	},
} satisfies StylesObject

const mobileStyles = {
	listItemGridItem: {
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'start',
		alignItems: 'start',
	},
	valueText: {
		fontSize: 'sm',
		fontWeight: 'bold',
		textAlign: 'left',
		whiteSpace: 'normal',
		wordBreak: 'break-word',
		overflowWrap: 'break-word',
	},
	titleText: {
		fontSize: 'xs',
		color: '#929494',
	},
	accordionButton: {
		flexGrow: 1,
		width: '100%',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	accordionItem: {
		borderColor: '#EAEAEA',
		borderTop: 'none',
		_notLast: {
			borderBottom: '1px solid',
			borderBottomColor: '#EAEAEA',
		},
	},
	actionsContainer: {
		mt: '2rem',
		alignItems: 'center',
		gap: '1.25rem',
		flexWrap: 'wrap',
	},
	checkboxWrapper: {
		width: '100%',
		justifyContent: 'flex-start',
		alignItems: 'center',
		p: 4,
	},
} satisfies StylesObject

interface ProjectListActionBarProps {
	selectedProjects: Project[]
}

const ProjectListActionBar = ({
	selectedProjects,
}: ProjectListActionBarProps) => {
	const { t } = useTranslation()
	const { canSee } = useSee()
	const { isOpen, onOpen, onClose } = useDisclosure()
	const showToast = useCustomToast()
	const [bulkDelete, { isLoading: isDeleting }] =
		useBulkDeleteProjectsMutation()
	const canDelete = canSee(SEE.projectsDelete)
	const { deleteDisabled, deleteTooltip } =
		useMasterBulkDelete(selectedProjects)

	const handleDelete = async () => {
		try {
			const result = await bulkDelete(
				selectedProjects.map(project => project.projectId),
			).unwrap()

			onClose()

			if (result.deleted.length) {
				showToast({
					status: 'success',
					description: t('components.project.deleteSelectedSuccess', {
						count: result.deleted.length,
					}),
				})
			}

			if (result.blocked.length) {
				showToast({
					status: 'error',
					description: deleteErrorDescription(
						t,
						result.blocked[0]?.reason,
						t('components.project.deleteProjectError'),
					),
				})
			}
		} catch (error) {
			const err = error as { data?: { message?: string } }

			showToast({
				status: 'error',
				description: deleteErrorDescription(
					t,
					err.data?.message,
					t('components.project.deleteProjectError'),
				),
			})
		}
	}

	return (
		<Flex sx={actionBarStyles.mainFlexWrapper}>
			<Text sx={actionBarStyles.text}>
				{`${selectedProjects.length} 	${t('common.selected')}`}
			</Text>
			{canDelete ? (
				<Tooltip label={deleteTooltip} isDisabled={!deleteTooltip}>
					<span>
						<IconButton
							sx={actionBarStyles.iconButton}
							aria-label={t('components.project.deleteSelected')}
							icon={<AsTrashIcon boxSize={5} />}
							size="sm"
							onClick={onOpen}
							isDisabled={deleteDisabled}
						/>
					</span>
				</Tooltip>
			) : null}
			<ConfirmationDialog
				header={t('components.project.deleteSelected')}
				body={t('components.project.deleteSelectedConfirm', {
					count: selectedProjects.length,
				})}
				isOpen={isOpen}
				onClose={onClose}
				onConfirm={handleDelete}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeleting}
			/>
		</Flex>
	)
}

interface ProjectRowProps {
	project: Project
	isSelected: boolean
	isLoading: boolean
	isHovered: boolean
	onSelect: (id: string) => void
}

const ProjectRow = ({
	project,
	isSelected,
	isLoading,
	isHovered,
	onSelect,
}: ProjectRowProps) => {
	const { t } = useTranslation()
	const { formatAmount } = useInvoiceDisplayCurrency()
	const showToast = useCustomToast()
	const { deleteDisabled, deleteTooltip } = useMasterDelete(project)
	const total = project.outstanding ?? 0
	const {
		isOpen: isDeleteOpen,
		onOpen: onDeleteOpen,
		onClose: onDeleteClose,
	} = useDisclosure()
	const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation()
	const backgroundColor = isHovered ? '#F4F4F4' : '#FFFFFF'

	return (
		<>
			<Td
				sx={{
					...rowStyles.tableRow,
					...rowStyles.checkboxRow,
					backgroundColor,
				}}
			>
				<Flex
					sx={{ ...rowStyles.cellContentWrapper, backgroundColor }}
					onClick={event => {
						onSelect(project.projectId)
						event.stopPropagation()
					}}
					cursor="pointer"
				>
					<Skeleton isLoaded={!isLoading}>
						<Checkbox
							pointerEvents="none"
							isChecked={isSelected}
							zIndex={2}
							padding={4}
						/>
					</Skeleton>
				</Flex>
			</Td>
			<Td sx={rowStyles.tableRow}>
				<Flex sx={rowStyles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text sx={{ ...rowStyles.text, fontWeight: 500 }}>
							{projectName(project)}
						</Text>
					</Skeleton>
				</Flex>
			</Td>
			<Td sx={rowStyles.tableRow}>
				<Flex sx={rowStyles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text sx={{ ...rowStyles.text, fontWeight: 500 }}>
							{projectCode(project)}
						</Text>
					</Skeleton>
				</Flex>
			</Td>
			<Td sx={rowStyles.tableRow}>
				<Flex sx={rowStyles.cellContentWrapper}>
					<Skeleton isLoaded={!isLoading}>
						<Text
							sx={{
								...rowStyles.text,
								fontWeight: total > 0 ? 600 : 500,
								color: total > 0 ? PAGE_COLORS.danger : PAGE_COLORS.success,
							}}
						>
							{formatAmount(total)}
						</Text>
					</Skeleton>
				</Flex>
			</Td>
			<Td
				sx={{ ...rowStyles.tableRow, ...rowStyles.rightStickyContainer }}
				onClick={event => event.stopPropagation()}
			>
				<Flex sx={rowStyles.rightStickyContainerContent}>
					<Skeleton isLoaded={!isLoading}>
						<NotificationCircle
							productId={project.projectId}
							showIfNoChanges={true}
							customStyles={{
								animationCircle: { width: '1.5rem', height: '1.5rem' },
							}}
						>
							<StateCircle
								stateColor={
									total > 0 ? PAGE_COLORS.danger : PAGE_COLORS.success
								}
								stateTitle={total > 0 ? 'common.inactive' : 'common.active'}
								customStyles={{
									colorCircle: { width: '0.875rem', height: '0.875rem' },
								}}
							/>
						</NotificationCircle>
					</Skeleton>
					<Skeleton isLoaded={!isLoading}>
						<OptionsPopover
							onDelete={onDeleteOpen}
							deleteLabel={t('components.project.deleteProject')}
							deleteDisabled={deleteDisabled}
							deleteTooltip={deleteTooltip}
						/>
					</Skeleton>
				</Flex>
			</Td>
			<ConfirmationDialog
				header={t('components.project.deleteProject')}
				body={t('components.project.deleteProjectConfirm')}
				isOpen={isDeleteOpen}
				onClose={onDeleteClose}
				onConfirm={async () => {
					try {
						await deleteProject(project.projectId).unwrap()
						onDeleteClose()
						showToast({
							status: 'success',
							description: t('components.project.deleteProjectSuccess'),
						})
					} catch (error) {
						const err = error as { data?: { message?: string } }

						showToast({
							status: 'error',
							description: deleteErrorDescription(
								t,
								err.data?.message,
								t('components.project.deleteProjectError'),
							),
						})
					}
				}}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeleting}
			/>
		</>
	)
}

const ProjectMobileItem = ({
	project,
	isLoading,
	onSelect,
	selectedIds,
	isOpen,
	onToggle,
}: {
	project: Project
	isLoading: boolean
	onSelect: (id: string) => void
	selectedIds: string[]
	isOpen: boolean
	onToggle: () => void
}) => {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()
	const openProject = () =>
		navigate(buildRoutePath.projectById(project.projectId))
	const isArabic = i18n.language?.startsWith('ar')
	const { formatAmount } = useInvoiceDisplayCurrency()
	const showToast = useCustomToast()
	const { deleteDisabled, deleteTooltip } = useMasterDelete(project)
	const total = project.outstanding ?? 0
	const {
		isOpen: isDeleteOpen,
		onOpen: onDeleteOpen,
		onClose: onDeleteClose,
	} = useDisclosure()
	const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation()

	return (
		<>
			<Accordion allowToggle index={isOpen ? [0] : []} onChange={onToggle}>
				<AccordionItem sx={mobileStyles.accordionItem}>
					<AccordionButton sx={mobileStyles.accordionButton}>
						<Flex alignItems="center" gap="6" flexGrow={1}>
							<Box
								sx={{ ...mobileStyles.listItemGridItem, width: '1.5rem' }}
								onClick={event => {
									onSelect(project.projectId)
									event.stopPropagation()
								}}
							>
								<Skeleton isLoaded={!isLoading}>
									<Checkbox
										isChecked={selectedIds.includes(project.projectId)}
										pointerEvents="none"
									/>
								</Skeleton>
							</Box>
							<Box sx={{ ...mobileStyles.listItemGridItem, flex: 1 }}>
								<Text sx={mobileStyles.titleText}>
									{t('components.project.name')}
								</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text
										sx={mobileStyles.valueText}
										cursor="pointer"
										onClick={event => {
											event.stopPropagation()
											openProject()
										}}
									>
										{withNoValueFallback(projectName(project))}
									</Text>
								</Skeleton>
							</Box>
							<Box sx={{ ...mobileStyles.listItemGridItem, flex: 1 }}>
								<Text sx={mobileStyles.titleText}>
									{t('components.project.code')}
								</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={mobileStyles.valueText}>
										{withNoValueFallback(projectCode(project))}
									</Text>
								</Skeleton>
							</Box>
						</Flex>
						<AccordionIcon minWidth="3rem" />
					</AccordionButton>
					<AccordionPanel
						overflow="hidden"
						paddingLeft={isArabic ? 0 : 16}
						paddingRight={isArabic ? 16 : 0}
					>
						<Grid templateColumns="repeat(2, 1fr)" gap="6">
							<GridItem sx={mobileStyles.listItemGridItem}>
								<Text sx={mobileStyles.titleText}>
									{t('components.project.total')}
								</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text
										sx={{
											...mobileStyles.valueText,
											color:
												total > 0 ? PAGE_COLORS.danger : PAGE_COLORS.success,
										}}
									>
										{formatAmount(total)}
									</Text>
								</Skeleton>
							</GridItem>
						</Grid>
						<Flex
							sx={{
								...mobileStyles.actionsContainer,
								justifyContent: isArabic ? 'flex-start' : 'flex-end',
							}}
						>
							<NotificationCircle
								productId={project.projectId}
								showIfNoChanges={true}
								customStyles={{
									animationCircle: { width: '1.5rem', height: '1.5rem' },
								}}
							>
								<StateCircle
									stateColor={
										total > 0 ? PAGE_COLORS.danger : PAGE_COLORS.success
									}
									stateTitle={total > 0 ? 'common.inactive' : 'common.active'}
									customStyles={{
										colorCircle: { width: '0.875rem', height: '0.875rem' },
									}}
								/>
							</NotificationCircle>
							<OptionsPopover
								onDelete={onDeleteOpen}
								deleteLabel={t('components.project.deleteProject')}
								deleteDisabled={deleteDisabled}
								deleteTooltip={deleteTooltip}
							/>
						</Flex>
					</AccordionPanel>
				</AccordionItem>
			</Accordion>
			<ConfirmationDialog
				header={t('components.project.deleteProject')}
				body={t('components.project.deleteProjectConfirm')}
				isOpen={isDeleteOpen}
				onClose={onDeleteClose}
				onConfirm={async () => {
					try {
						await deleteProject(project.projectId).unwrap()
						onDeleteClose()
						showToast({
							status: 'success',
							description: t('components.project.deleteProjectSuccess'),
						})
					} catch (error) {
						const err = error as { data?: { message?: string } }

						showToast({
							status: 'error',
							description: deleteErrorDescription(
								t,
								err.data?.message,
								t('components.project.deleteProjectError'),
							),
						})
					}
				}}
				cancelButtonText={t('common.cancel')}
				confirmationButtonText={t('common.delete')}
				isConfirmationButtonLoading={isDeleting}
			/>
		</>
	)
}

interface ProjectListWithActionBarProps {
	projects?: Project[]
	isLoading: boolean
}

const ProjectListWithActionBar = ({
	projects,
	isLoading,
}: ProjectListWithActionBarProps) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const [searchText, setSearchText] = useState('')
	const [selectedIds, setSelectedIds] = useState<string[]>([])
	const [sortField, setSortField] = useState<ProjectSortKey | null>(null)
	const [sortOrder, setSortOrder] = useState<SortOrder | null>(null)
	const [hoveredHeader, setHoveredHeader] = useState<number | null>(null)
	const [openId, setOpenId] = useState<string | null>(null)
	const [hoveredId, setHoveredId] = useState<string | null>(null)

	const rows = useMemo(
		() =>
			(projects ?? []).map(project => ({
				...project,
				name: projectName(project),
				internalCode: projectCode(project),
			})),
		[projects],
	)

	const filtered = useMemo(
		() => rows.filter(project => matchesNameOrCode(project, searchText)),
		[rows, searchText],
	)

	const sorted = useMemo(() => {
		if (!sortField) return filtered
		return [...filtered].sort((a, b) => {
			if (sortField === 'name') {
				return compareStringsForSorting(a.name, b.name, sortOrder)
			}
			if (sortField === 'code') {
				return compareStringsForSorting(
					a.internalCode,
					b.internalCode,
					sortOrder,
				)
			}
			return compareNumbersForSorting(
				a.outstanding ?? 0,
				b.outstanding ?? 0,
				sortOrder,
			)
		})
	}, [filtered, sortField, sortOrder])

	const onSelect = useCallback((id: string) => {
		setSelectedIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])

	const onAllItemsSelectedChange = useCallback(() => {
		setSelectedIds(prev =>
			prev.length === filtered.length
				? []
				: filtered.map(project => project.projectId),
		)
	}, [filtered])

	useEffect(() => {
		setSelectedIds(prev =>
			prev.filter(id => filtered.some(project => project.projectId === id)),
		)
	}, [filtered])

	if (rows.length === 0 && !isLoading) {
		return (
			<EmptyState
				title={t('common.emptyStateTitle')}
				description={t('common.emptyStateDescription')}
			/>
		)
	}

	const headers: Array<{
		label: string | null
		width: number
		sortKey: ProjectSortKey | null
		isCheckbox?: boolean
		isStickyRight?: boolean
	}> = [
		{
			label: null,
			width: CUSTOMER_LIST_WIDTHS_MAP_IN_REM.CHECKBOX,
			sortKey: null,
			isCheckbox: true,
		},
		{
			label: t('components.project.name'),
			width: CUSTOMER_LIST_WIDTHS_MAP_IN_REM.NAME,
			sortKey: 'name',
		},
		{
			label: t('components.project.code'),
			width: CUSTOMER_LIST_WIDTHS_MAP_IN_REM.INTERNAL_CODE,
			sortKey: 'code',
		},
		{
			label: t('components.project.total'),
			width: CUSTOMER_LIST_WIDTHS_MAP_IN_REM.TOTAL_RECEIVABLE,
			sortKey: 'total',
		},
		{
			label: null,
			width: CUSTOMER_LIST_WIDTHS_MAP_IN_REM.STICKY_RIGHT,
			sortKey: null,
			isStickyRight: true,
		},
	]

	const selectedProjects = filtered.filter(project =>
		selectedIds.includes(project.projectId),
	)

	return (
		<VStack w="100%" p={0} align="stretch">
			<Box px={4} mb={3} maxW={{ base: '100%', md: '21rem' }}>
				<InputGroup size="sm">
					<InputLeftElement pointerEvents="none">
						<Icon as={AsSearchIcon} color="#929494" boxSize={5} />
					</InputLeftElement>
					<Input
						value={searchText}
						onChange={event => setSearchText(event.target.value)}
						placeholder={t('components.filters.nameOrCodeSearchPlaceholder')}
						borderRadius="lg"
						bg="gray.50"
						border="1px solid"
						borderColor="#EAEAEA"
						pl={10}
						autoComplete="off"
						spellCheck={false}
					/>
				</InputGroup>
			</Box>

			{selectedIds.length > 0 && (
				<ProjectListActionBar selectedProjects={selectedProjects} />
			)}

			{sorted.length === 0 && !isLoading ? (
				<EmptyState
					title={t('common.emptyStateTitle')}
					description={t('common.emptyStateDescription')}
				/>
			) : isMobile ? (
				<>
					<Flex sx={mobileStyles.checkboxWrapper}>
						<Checkbox
							isChecked={
								filtered.length > 0 && selectedIds.length === filtered.length
							}
							onChange={onAllItemsSelectedChange}
						/>
					</Flex>
					{sorted.map(project => (
						<ProjectMobileItem
							key={project.projectId}
							project={project}
							isLoading={isLoading}
							onSelect={onSelect}
							selectedIds={selectedIds}
							isOpen={openId === project.projectId}
							onToggle={() =>
								setOpenId(prev =>
									prev === project.projectId ? null : project.projectId,
								)
							}
						/>
					))}
				</>
			) : (
				<Box overflowX="auto" w="100%">
					<Table variant="simple" size="sm" layout="fixed">
						<Thead>
							<Tr background="#fff">
								{headers.map((header, index) => {
									if (header.isCheckbox) {
										return (
											<Th
												key="checkbox"
												sx={headerStyles.checkboxHeader}
												width={`${header.width}rem`}
											>
												<Checkbox
													isChecked={
														filtered.length > 0 &&
														selectedIds.length === filtered.length
													}
													onChange={onAllItemsSelectedChange}
												/>
											</Th>
										)
									}
									if (header.isStickyRight) {
										return (
											<Th
												key="sticky"
												sx={{
													...headerStyles.tableHeaderStickyRight,
													background:
														'linear-gradient(to right, transparent 0rem, #FFFFFF 7rem)',
													width: `${header.width}rem`,
												}}
											/>
										)
									}
									return (
										<Th
											key={header.sortKey ?? index}
											sx={headerStyles.tableHeader}
											width={`${header.width}rem`}
											onMouseEnter={() => setHoveredHeader(index)}
											onMouseLeave={() => setHoveredHeader(null)}
										>
											<Flex
												alignItems="center"
												sx={headerStyles.tableHeaderText}
											>
												<Text sx={headerStyles.tableHeaderText}>
													{header.label}
												</Text>
												{header.sortKey &&
													(hoveredHeader === index ||
														sortField === header.sortKey) && (
														<Box marginLeft="0.5rem">
															<TableSort
																handleSort={order => {
																	setSortField(header.sortKey)
																	setSortOrder(order)
																}}
																sortingOrder={
																	sortField === header.sortKey
																		? sortOrder
																		: null
																}
															/>
														</Box>
													)}
											</Flex>
										</Th>
									)
								})}
							</Tr>
						</Thead>
						<Tbody>
							{sorted.map(project => (
								<Tr
									key={project.projectId}
									background={
										hoveredId === project.projectId ? '#F9F9F9' : '#FFFFFF'
									}
									cursor="pointer"
									onClick={() =>
										navigate(buildRoutePath.projectById(project.projectId))
									}
									onMouseEnter={() => setHoveredId(project.projectId)}
									onMouseLeave={() => setHoveredId(null)}
								>
									<ProjectRow
										project={project}
										isSelected={selectedIds.includes(project.projectId)}
										isLoading={isLoading}
										isHovered={hoveredId === project.projectId}
										onSelect={onSelect}
									/>
								</Tr>
							))}
						</Tbody>
					</Table>
				</Box>
			)}
		</VStack>
	)
}

export default ProjectListWithActionBar
