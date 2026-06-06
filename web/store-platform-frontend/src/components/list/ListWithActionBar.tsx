import { Box, Center, Text, VStack } from '@chakra-ui/react'
import ListActionBar from './ListActionBar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBreakpoints } from '../../shared/hooks/useBreakpoints'
import { compareBreakpoint } from '../../shared/utils'
import ListDesktop from './ListDesktop'
import DailyActionListDesktop from './DailyActionListDesktop'
import useCustomToast from '../common/CustomToast'

const styles: StylesObject = {
	noElements: {
		color: '#6F6F6F',
		fontWeight: '700',
		marginTop: '3rem',
	},
}

interface ListWithActionBarProps {
	products?: Product[]
	dailyActions?: DailyAction[]
	isLoading: boolean
}

const ListWithActionBar = ({
	products,
	dailyActions,
	isLoading,
}: ListWithActionBarProps) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const [selectedElementId, setSelectedElementIds] = useState<string[]>([])

	const isDailyActionMode = dailyActions !== undefined

	// --- Product list state ---
	const listElements: Product[] = useMemo(() => {
		if (isDailyActionMode) return []
		return (
			products?.map((product: Product) => ({
				...product,
				isSelectable: true,
			})) || []
		)
	}, [products, isDailyActionMode])

	// --- Daily action list state ---
	const dailyActionElements: DailyAction[] = useMemo(() => {
		if (!isDailyActionMode) return []
		return dailyActions ?? []
	}, [dailyActions, isDailyActionMode])

	const activeLength = isDailyActionMode
		? dailyActionElements.length
		: listElements.length

	const onSelect = useCallback((id: string) => {
		setSelectedElementIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])

	const onAllItemsSelectedChange = useCallback(() => {
		if (isDailyActionMode) {
			setSelectedElementIds(prevSelectedIds =>
				prevSelectedIds.length === dailyActionElements.length
					? []
					: dailyActionElements.map(a => a._id ?? a.actionId ?? ''),
			)
		} else {
			setSelectedElementIds(prevSelectedIds =>
				prevSelectedIds.length === listElements.length
					? []
					: listElements.map(a => a.productId),
			)
		}
	}, [listElements, dailyActionElements, isDailyActionMode])

	const areAllItemsSelected = selectedElementId.length === activeLength

	useEffect(() => {
		if (isDailyActionMode) {
			setSelectedElementIds(prev =>
				prev.filter(id =>
					dailyActionElements.some(a => (a._id ?? a.actionId ?? '') === id),
				),
			)
		} else {
			setSelectedElementIds(prev =>
				prev.filter(id => listElements.some(a => a.productId === id)),
			)
		}
	}, [listElements, dailyActionElements, isDailyActionMode])

	const onAddRequiredDocument = async (
		selectedElements: Product[],
		data: {},
	) => {
		const succeededElements: string[] = []
		for (const element of selectedElements) {
			const eventType = 'PROMO'
			try {
				// await addRequiredDocument({
				// 	elementId: element.id,
				// 	data,
				// 	eventType,
				// }).unwrap()
				// succeededElements.push(element.id)
				// if (succeededElements.length === selectedElements.length) {
				// 	showToastMessage({
				// 		status: 'success',
				// 		description: t('components.list.multiAddRequiredDocumentSuccess'),
				// 	})
				// }
			} catch (error) {
				showToastMessage({
					status: 'error',
					description: t('components.list.multiAddRequiredDocumentError', {
						count: selectedElements.length - succeededElements.length,
						total: selectedElements.length,
					}),
				})
				break
			}
		}
	}

	if (activeLength === 0 && !isLoading) {
		return (
			<Box>
				<Center>
					<Text sx={styles.noElements}>{t('common.noElementsFound')}</Text>
				</Center>
			</Box>
		)
	}

	return (
		<VStack w="100%" p={0}>
			{!isDailyActionMode && selectedElementId.length > 0 && (
				<ListActionBar
					selectedActivities={
						(selectedElementId
							.map(id =>
								listElements?.find(element => element.productId === id),
							)
							.filter(Boolean) as Product[]) ?? []
					}
					isRejectActivityInProgress={false}
					onAddRequiredDocument={onAddRequiredDocument}
					isAddRequiredDocumentInProgress={false}
				/>
			)}
			{isMobile ? (
				<></>
			) : isDailyActionMode ? (
				<DailyActionListDesktop
					dailyActions={dailyActionElements}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedIds={selectedElementId}
					areAllItemsSelected={areAllItemsSelected}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			) : (
				<ListDesktop
					products={listElements ?? []}
					isLoading={isLoading}
					onSelect={onSelect}
					selectedProducts={selectedElementId}
					areAllItemsSelected={areAllItemsSelected}
					onAllItemsSelectedChange={onAllItemsSelectedChange}
				/>
			)}
		</VStack>
	)
}
export default ListWithActionBar
