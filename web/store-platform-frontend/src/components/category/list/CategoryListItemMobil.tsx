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
	Skeleton,
	Text,
	useDisclosure,
} from '@chakra-ui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../../shared/dateUtils'
import { compareLanguage, withNoValueFallback } from '../../../shared/utils'
import NotificationCircle from '../../NotificationCircle'
import StateCircle from '../../StateCircle'
import OptionsPopover from '../../modals/OptionsPopover'
import ConfirmationDialog from '../../ConfirmationDialog'
import { useDeleteCategoryMutation } from '../../../api/apiStore'
import useCustomToast from '../../common/CustomToast'
import { useSee } from '../../../shared/hooks/useSee'
import { SEE } from '../../../shared/seeFlags'

const styles = {
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
	statusContainer: {
		alignItems: 'center',
		gap: '1rem',
		justifyContent: 'flex-end',
	},
	actionsContainer: {
		mt: '2rem',
		alignItems: 'center',
		gap: '1.25rem',
		flexWrap: 'wrap',
	},
} satisfies StylesObject

interface CategoryListItemMobilProps {
	category: Category
	isLoading: boolean
	onSelect: (id: string) => void
	selectedCategories: string[]
	isOpen: boolean
	onToggle: () => void
}

const CategoryListItemMobil = ({
	category,
	isLoading,
	onSelect,
	selectedCategories,
	isOpen,
	onToggle,
}: CategoryListItemMobilProps) => {
	const { t, i18n } = useTranslation()
	const { isArabic } = compareLanguage(i18n.language)
	const { canSee } = useSee()
	const canDelete = canSee(SEE.categoriesDelete)
	const showToast = useCustomToast()
	const {
		isOpen: isDeleteOpen,
		onOpen: onDeleteOpen,
		onClose: onDeleteClose,
	} = useDisclosure()
	const [deleteCategory, { isLoading: isDeleting }] =
		useDeleteCategoryMutation()

	return (
		<>
			<Accordion allowToggle index={isOpen ? [0] : []} onChange={onToggle}>
				<AccordionItem sx={styles.accordionItem}>
					<Box display="flex" flexDirection="row">
						<AccordionButton sx={styles.accordionButton}>
							<Flex alignItems="center" gap="6" flexGrow={1}>
								{canDelete ? (
									<Box
										sx={{
											...styles.listItemGridItem,
											width: '1.5rem',
											flex: '0 0 auto',
										}}
									>
										<Skeleton isLoaded={!isLoading}>
											<Checkbox
												onChange={event => {
													onSelect(category.categoryId)
													event.stopPropagation()
												}}
												isChecked={selectedCategories.includes(
													category.categoryId,
												)}
												zIndex={2}
											/>
										</Skeleton>
									</Box>
								) : null}

								<Box sx={{ ...styles.listItemGridItem, flex: 1 }}>
									<Text sx={styles.titleText}>{t('category.list.name')}</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{withNoValueFallback(category.name)}
										</Text>
									</Skeleton>
								</Box>

								<Box sx={{ ...styles.listItemGridItem, flex: 1 }}>
									<Text sx={styles.titleText}>
										{t('category.list.description')}
									</Text>
									<Skeleton isLoaded={!isLoading}>
										<Text sx={styles.valueText}>
											{withNoValueFallback(category.description)}
										</Text>
									</Skeleton>
								</Box>
							</Flex>
							<AccordionIcon minWidth="3rem" />
						</AccordionButton>
					</Box>

					<AccordionPanel
						overflow="hidden"
						paddingLeft={isArabic ? 0 : 16}
						paddingRight={isArabic ? 16 : 0}
					>
						<Grid templateColumns="repeat(2, 1fr)" gap="6">
							<GridItem sx={styles.listItemGridItem}>
								<Text sx={styles.titleText}>
									{t('category.list.createdAt')}
								</Text>
								<Skeleton isLoaded={!isLoading}>
									<Text sx={styles.valueText}>
										{category.createdAt
											? formatDate(new Date(category.createdAt))
											: '-'}
									</Text>
								</Skeleton>
							</GridItem>
						</Grid>
						<Flex
							sx={{
								...styles.actionsContainer,
								justifyContent: isArabic ? 'flex-start' : 'flex-end',
							}}
						>
							<Skeleton isLoaded={!isLoading}>
								<NotificationCircle
									productId={category.categoryId}
									showIfNoChanges={true}
									customStyles={{
										animationCircle: { width: '1.5rem', height: '1.5rem' },
									}}
								>
									<StateCircle
										stateColor="#929494"
										stateTitle="inactive"
										customStyles={{
											colorCircle: { width: '0.875rem', height: '0.875rem' },
										}}
									/>
								</NotificationCircle>
							</Skeleton>

							<Skeleton isLoaded={!isLoading}>
								{canDelete ? (
									<OptionsPopover
										onDelete={onDeleteOpen}
										deleteLabel={t('category.deleteCategory')}
									/>
								) : null}
							</Skeleton>
						</Flex>
					</AccordionPanel>
				</AccordionItem>
			</Accordion>
			<ConfirmationDialog
				header={t('category.deleteCategory')}
				body={t('category.deleteCategoryConfirm')}
				isOpen={isDeleteOpen}
				onClose={onDeleteClose}
				onConfirm={async () => {
					try {
						await deleteCategory(category.categoryId).unwrap()
						onDeleteClose()
						showToast({
							status: 'success',
							description: t('category.deleteCategorySuccess'),
						})
					} catch (error) {
						const err = error as { data?: { message?: string } }

						showToast({
							status: 'error',
							description:
								err.data?.message || t('category.deleteCategoryError'),
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

export default CategoryListItemMobil
