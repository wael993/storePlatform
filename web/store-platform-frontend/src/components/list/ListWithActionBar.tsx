import { Box, Center, Text, VStack } from '@chakra-ui/react'
import ListActionBar from './ListActionBar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBreakpoints } from '../../shared/hooks/useBreakpoints'
import { compareBreakpoint } from '../../shared/utils'
import ListDesktop from './ListDesktop'
import DailyActionListDesktop from './DailyActionListDesktop'
import SimpleEntityListDesktop, {
	SimpleEntity,
} from './SimpleEntityListDesktop'
import useCustomToast from '../common/CustomToast'

const styles: StylesObject = {
	noElements: {
		color: '#6F6F6F',
		fontWeight: '700',
		marginTop: '3rem',
	},
}

type ListMode = 'product' | 'dailyAction' | 'customer' | 'supplier'

interface ListWithActionBarProps {
	customers?: Customer[]
	suppliers?: Supplier[]
	products?: Product[]
	dailyActions?: DailyAction[]
	isLoading: boolean
}

const toSimpleEntity = {
	fromCustomer: (c: Customer): SimpleEntity => ({
		id: c.customerId,
		name: c.name,
		internalCode: c.internalCode,
		createdAt: c.createdAt,
	}),
	fromSupplier: (s: Supplier): SimpleEntity => ({
		id: s.supplierId,
		name: s.name,
		internalCode: s.internalCode,
		createdAt: s.createdAt,
	}),
}

const ListWithActionBar = ({
	customers,
	suppliers,
	products,
	dailyActions,
	isLoading,
}: ListWithActionBarProps) => {
	const { t } = useTranslation()
	const showToastMessage = useCustomToast()
	const { isMobile } = compareBreakpoint(useBreakpoints())
	const [selectedElementId, setSelectedElementIds] = useState<string[]>([])

	const mode: ListMode = useMemo(() => {
		if (dailyActions !== undefined) return 'dailyAction'
		if (customers !== undefined) return 'customer'
		if (suppliers !== undefined) return 'supplier'
		return 'product'
	}, [dailyActions, customers, suppliers])

	// --- Product list state ---
	const listElements: Product[] = useMemo(() => {
		if (mode !== 'product') return []
		return (
			products?.map((product: Product) => ({
				...product,
				isSelectable: true,
			})) || []
		)
	}, [products, mode])

	// --- Daily action list state ---
	const dailyActionElements: DailyAction[] = useMemo(() => {
		if (mode !== 'dailyAction') return []
		return dailyActions ?? []
	}, [dailyActions, mode])

	// --- Customer list state ---
	const customerElements: SimpleEntity[] = useMemo(() => {
		if (mode !== 'customer') return []
		return customers?.map(toSimpleEntity.fromCustomer) ?? []
	}, [customers, mode])

	// --- Supplier list state ---
	const supplierElements: SimpleEntity[] = useMemo(() => {
		if (mode !== 'supplier') return []
		return suppliers?.map(toSimpleEntity.fromSupplier) ?? []
	}, [suppliers, mode])

	const activeLength = useMemo(() => {
		switch (mode) {
			case 'dailyAction':
				return dailyActionElements.length
			case 'customer':
				return customerElements.length
			case 'supplier':
				return supplierElements.length
			default:
				return listElements.length
		}
	}, [
		mode,
		dailyActionElements,
		customerElements,
		supplierElements,
		listElements,
	])

	const onSelect = useCallback((id: string) => {
		setSelectedElementIds(prev =>
			prev.includes(id)
				? prev.filter(selectedId => selectedId !== id)
				: [...prev, id],
		)
	}, [])

	const onAllItemsSelectedChange = useCallback(() => {
		switch (mode) {
			case 'dailyAction':
				setSelectedElementIds(prev =>
					prev.length === dailyActionElements.length
						? []
						: dailyActionElements.map(a => a._id ?? a.actionId ?? ''),
				)
				break
			case 'customer':
				setSelectedElementIds(prev =>
					prev.length === customerElements.length
						? []
						: customerElements.map(e => e.id),
				)
				break
			case 'supplier':
				setSelectedElementIds(prev =>
					prev.length === supplierElements.length
						? []
						: supplierElements.map(e => e.id),
				)
				break
			default:
				setSelectedElementIds(prev =>
					prev.length === listElements.length
						? []
						: listElements.map(a => a.productId),
				)
		}
	}, [
		mode,
		listElements,
		dailyActionElements,
		customerElements,
		supplierElements,
	])

	const areAllItemsSelected =
		selectedElementId.length === activeLength && activeLength > 0

	useEffect(() => {
		switch (mode) {
			case 'dailyAction':
				setSelectedElementIds(prev =>
					prev.filter(id =>
						dailyActionElements.some(a => (a._id ?? a.actionId ?? '') === id),
					),
				)
				break
			case 'customer':
				setSelectedElementIds(prev =>
					prev.filter(id => customerElements.some(e => e.id === id)),
				)
				break
			case 'supplier':
				setSelectedElementIds(prev =>
					prev.filter(id => supplierElements.some(e => e.id === id)),
				)
				break
			default:
				setSelectedElementIds(prev =>
					prev.filter(id => listElements.some(a => a.productId === id)),
				)
		}
	}, [
		mode,
		listElements,
		dailyActionElements,
		customerElements,
		supplierElements,
	])

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

	const renderList = () => {
		if (isMobile) return <></>

		switch (mode) {
			case 'dailyAction':
				return (
					<DailyActionListDesktop
						dailyActions={dailyActionElements}
						isLoading={isLoading}
						onSelect={onSelect}
						selectedIds={selectedElementId}
						areAllItemsSelected={areAllItemsSelected}
						onAllItemsSelectedChange={onAllItemsSelectedChange}
					/>
				)
			case 'customer':
				return (
					<SimpleEntityListDesktop
						entities={customerElements}
						isLoading={isLoading}
						onSelect={onSelect}
						selectedIds={selectedElementId}
						areAllItemsSelected={areAllItemsSelected}
						onAllItemsSelectedChange={onAllItemsSelectedChange}
					/>
				)
			case 'supplier':
				return (
					<SimpleEntityListDesktop
						entities={supplierElements}
						isLoading={isLoading}
						onSelect={onSelect}
						selectedIds={selectedElementId}
						areAllItemsSelected={areAllItemsSelected}
						onAllItemsSelectedChange={onAllItemsSelectedChange}
					/>
				)
			default:
				return (
					<ListDesktop
						products={listElements ?? []}
						isLoading={isLoading}
						onSelect={onSelect}
						selectedProducts={selectedElementId}
						areAllItemsSelected={areAllItemsSelected}
						onAllItemsSelectedChange={onAllItemsSelectedChange}
					/>
				)
		}
	}

	return (
		<VStack w="100%" p={0}>
			{mode === 'product' && selectedElementId.length > 0 && (
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
			{renderList()}
		</VStack>
	)
}
export default ListWithActionBar
